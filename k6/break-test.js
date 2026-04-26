// k6-queue-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const searchDuration = new Trend('search_duration');
const queueWaitTime = new Trend('queue_wait_time');
const failedRequests = new Counter('failed_requests');
const queuedRequests = new Counter('queued_requests');
const completedRequests = new Counter('completed_requests');

const BASE_URL = 'http://localhost:3000';
const TOTAL_RECORDS = 4000;
const POLL_INTERVAL = 1; // seconds
const MAX_POLL_ATTEMPTS = 30; // 30 seconds max wait

// Generate student data
function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);
  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (studentNumber - 1));
  
  return {
    student_number: studentNumber.toString(),
    date_of_birth: targetDate.toISOString().split('T')[0]
  };
}

// Submit request to queue (returns jobId)
function submitToQueue(studentNumber, dateOfBirth) {
  const url = `${BASE_URL}/grades/view-uncached-results?date_of_birth=${encodeURIComponent(dateOfBirth)}&student_number=${encodeURIComponent(studentNumber)}`;
  
  const startTime = Date.now();
  const response = http.get(url, {
    timeout: '5s', // Short timeout for submission
    headers: { 'Content-Type': 'application/json' }
  });
  const duration = Date.now() - startTime;
  
  searchDuration.add(duration);
  
  let success = false;
  let jobId = null;
  let position = null;
  
  try {
    if (response.status === 202) {
      const body = JSON.parse(response.body);
      if (body.success && body.data) {
        jobId = body.data.jobId;
        position = body.data.position;
        success = true;
        queuedRequests.add(1);
        console.log(`✅ Queued: Student ${studentNumber} | Job: ${jobId} | Position: ${position}`);
      }
    } else if (response.status === 503) {
      console.log(`❌ Queue full: Student ${studentNumber}`);
      failedRequests.add(1);
      errorRate.add(true);
    } else {
      console.log(`❌ Submission failed: Student ${studentNumber} | Status: ${response.status}`);
      failedRequests.add(1);
      errorRate.add(true);
    }
  } catch (e) {
    console.log(`❌ Parse error: ${e.message}`);
    failedRequests.add(1);
    errorRate.add(true);
  }
  
  errorRate.add(!success);
  return { success, jobId, position, duration };
}

// Poll for job status/result
function pollForResult(jobId, studentNumber) {
  const pollStartTime = Date.now();
  let attempts = 0;
  let result = null;
  
  while (attempts < MAX_POLL_ATTEMPTS) {
    const url = `${BASE_URL}/grades/queue/status/${jobId}`;
    const response = http.get(url, {
      timeout: '2s',
      headers: { 'Content-Type': 'application/json' }
    });
    
    attempts++;
    
    try {
      if (response.status === 200) {
        const body = JSON.parse(response.body);
        
        if (body.status === 'completed') {
          const waitTime = Date.now() - pollStartTime;
          queueWaitTime.add(waitTime);
          completedRequests.add(1);
          console.log(`✅ Completed: Student ${studentNumber} | Job: ${jobId} | Wait: ${waitTime}ms | Attempts: ${attempts}`);
          return { success: true, result: body.result, waitTime };
        } else if (body.status === 'failed') {
          console.log(`❌ Failed: Student ${studentNumber} | Job: ${jobId} | Reason: ${body.message}`);
          return { success: false, error: 'Job failed' };
        } else {
          // Still processing
          if (attempts % 5 === 0) {
            console.log(`⏳ Waiting: Student ${studentNumber} | Job: ${jobId} | Status: ${body.status} | Attempt: ${attempts}`);
          }
        }
      }
    } catch (e) {
      console.log(`❌ Status check error: ${e.message}`);
    }
    
    sleep(POLL_INTERVAL);
  }
  
  console.log(`⏰ Timeout: Student ${studentNumber} | Job: ${jobId} | ${MAX_POLL_ATTEMPTS} attempts`);
  return { success: false, error: 'Polling timeout' };
}

// Main function with queue workflow
function searchResultsWithQueue(studentNumber, dateOfBirth) {
  // Step 1: Submit to queue
  const submission = submitToQueue(studentNumber, dateOfBirth);
  
  if (!submission.success) {
    return { success: false, error: 'Submission failed' };
  }
  
  // Step 2: Poll for results
  const result = pollForResult(submission.jobId, studentNumber);
  
  return result;
}

// Legacy direct search (for comparison)
function searchResultsDirect(studentNumber, dateOfBirth) {
  const url = `${BASE_URL}/grades/view-uncached-results-direct?date_of_birth=${encodeURIComponent(dateOfBirth)}&student_number=${encodeURIComponent(studentNumber)}`;
  
  const startTime = Date.now();
  const response = http.get(url, {
    timeout: '30s',
    headers: { 'Content-Type': 'application/json' }
  });
  const duration = Date.now() - startTime;
  
  searchDuration.add(duration);
  
  let success = false;
  
  try {
    if (response.status === 200) {
      const body = JSON.parse(response.body);
      success = body.success === true;
    }
  } catch (e) {
    success = false;
  }
  
  errorRate.add(!success);
  if (!success) failedRequests.add(1);
  
  return { success, duration };
}

// ============================================
// SCENARIO 1: Queue Load Test (Recommended)
// ============================================
export const queueLoadTest = () => ({
  scenarios: {
    queue_breaking: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },    // 50 users
        { duration: '30s', target: 100 },   // 100 users
        { duration: '30s', target: 200 },   // 200 users
        { duration: '30s', target: 500 },   // 500 users
        { duration: '30s', target: 1000 },  // 1000 users
        { duration: '1m', target: 2000 },   // 2000 users
        { duration: '30s', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    error_rate: ['rate<0.1'],        // Allow up to 10% errors
    queue_wait_time: ['p(95)<30000'], // 95% of jobs complete within 30s
  },
});

// ============================================
// SCENARIO 2: Queue Stress Test (Very High Load)
// ============================================
export const queueStressTest = () => ({
  scenarios: {
    queue_stress: {
      executor: 'constant-vus',
      vus: 5000,  // 5000 concurrent users
      duration: '2m',
    },
  },
  thresholds: {
    error_rate: ['rate<0.2'],  // Allow 20% errors (queue might fill up)
  },
});

// ============================================
// SCENARIO 3: Queue Endurance Test
// ============================================
export const queueEnduranceTest = () => ({
  scenarios: {
    queue_endurance: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '10m', target: 500 },  // Hold for 10 minutes
        { duration: '2m', target: 0 },
      ],
    },
  },
});

// ============================================
// SCENARIO 4: Compare Queue vs Direct
// ============================================
export const comparisonTest = () => ({
  scenarios: {
    queue_traffic: {
      executor: 'constant-vus',
      vus: 500,
      duration: '1m',
      exec: 'queueTest',
      startTime: '0s',
    },
    direct_traffic: {
      executor: 'constant-vus',
      vus: 500,
      duration: '1m',
      exec: 'directTest',
      startTime: '0s',
    },
  },
});

// Default: Queue load test
export let options = queueLoadTest();

// Main test function (uses queue)
export default function() {
  const studentNumber = Math.floor(Math.random() * TOTAL_RECORDS) + 1;
  const student = generateStudentData(studentNumber);
  
  const result = searchResultsWithQueue(student.student_number, student.date_of_birth);
  
  if (!result.success) {
    console.log(`❌ Final failure for student ${studentNumber}: ${result.error}`);
  }
  
  // Add delay between requests to avoid overwhelming the queue submission
  sleep(Math.random() * 0.5);
}

// Queue-only test function
export function queueTest() {
  const studentNumber = Math.floor(Math.random() * TOTAL_RECORDS) + 1;
  const student = generateStudentData(studentNumber);
  searchResultsWithQueue(student.student_number, student.date_of_birth);
  sleep(Math.random() * 0.3);
}

// Direct-only test function (for comparison)
export function directTest() {
  const studentNumber = Math.floor(Math.random() * TOTAL_RECORDS) + 1;
  const student = generateStudentData(studentNumber);
  searchResultsDirect(student.student_number, student.date_of_birth);
  sleep(Math.random() * 0.3);
}

// Teardown
export function teardown(data) {
  console.log('\n========== QUEUE TEST COMPLETED ==========');
  console.log(`Queued Requests: ${queuedRequests.values.count}`);
  console.log(`Completed Requests: ${completedRequests.values.count}`);
  console.log(`Failed Requests: ${failedRequests.values.count}`);
  console.log(`Final Error Rate: ${(errorRate.values.rate * 100).toFixed(2)}%`);
  console.log(`Average Queue Wait Time: ${queueWaitTime.values.avg?.toFixed(2) || 0}ms`);
  console.log(`P95 Queue Wait Time: ${queueWaitTime.values.p95?.toFixed(2) || 0}ms`);
  console.log('===========================================\n');
}