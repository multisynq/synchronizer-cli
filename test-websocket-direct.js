#!/usr/bin/env node

/**
 * @fileoverview Direct WebSocket connection test utility
 * @description Standalone test script for validating WebSocket connectivity to the synchronizer container.
 * Tests connection to localhost:3333, sends various request types, and analyzes response quality.
 * 
 * @module test-websocket-direct
 * @requires ws
 * @requires chalk
 * @requires child_process
 * 
 * Usage: node test-websocket-direct.js
 * 
 * Tests performed:
 * - Container availability check
 * - WebSocket connection establishment
 * - Multiple request types (stats, debug, queryWalletStats, pingFromMain)
 * - Periodic stats polling every 5 seconds
 * - Data quality analysis
 * - Response time measurement
 */

const WebSocket = require('ws');
const chalk = require('chalk');

console.log(chalk.blue('🧪 Direct WebSocket Test Script'));
console.log(chalk.yellow('Testing connection to synchronizer container on localhost:3333\n'));

// Check if container is running first
const { execSync } = require('child_process');
try {
  const psOutput = execSync('docker ps --filter name=synchronizer --format "{{.Names}}"', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  if (!psOutput.trim()) {
    console.log(chalk.red('❌ No synchronizer container found running'));
    console.log(chalk.yellow('Start a container first with: synchronize start'));
    process.exit(1);
  }
  
  console.log(chalk.green(`✅ Found running container: ${psOutput.trim()}`));
} catch (error) {
  console.log(chalk.red('❌ Error checking containers:', error.message));
  process.exit(1);
}

// Connect to WebSocket
const wsUrl = 'ws://localhost:3333';
console.log(chalk.cyan(`🔌 Connecting to ${wsUrl}...`));

const ws = new WebSocket(wsUrl, {
  handshakeTimeout: 10000,
  timeout: 10000
});

let messageCount = 0;
let connectionStartTime = Date.now();

ws.on('open', () => {
  console.log(chalk.green('✅ WebSocket connected successfully!'));
  console.log(chalk.gray(`Connection established in ${Date.now() - connectionStartTime}ms\n`));
  
  // Send different types of requests to see what the container responds with
  const requests = [
    { what: 'stats' },
    { what: 'debug' },
    { what: 'queryWalletStats' },
    { what: 'pingFromMain' }
  ];
  
  console.log(chalk.blue('📡 Sending test requests...\n'));
  
  requests.forEach((request, index) => {
    setTimeout(() => {
      console.log(chalk.yellow(`→ Sending request ${index + 1}: ${JSON.stringify(request)}`));
      ws.send(JSON.stringify(request));
    }, index * 1000);
  });
  
  // Send periodic stats requests
  const statsInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(chalk.gray(`→ Requesting stats (periodic)...`));
      ws.send(JSON.stringify({ what: 'stats' }));
    } else {
      clearInterval(statsInterval);
    }
  }, 5000);
});

ws.on('message', (data) => {
  messageCount++;
  const timestamp = new Date().toLocaleTimeString();
  
  console.log(chalk.blue(`\n📨 Message ${messageCount} received at ${timestamp}:`));
  console.log(chalk.white('Raw data:'), data.toString());
  
  try {
    const parsed = JSON.parse(data.toString());
    console.log(chalk.green('✅ Parsed JSON:'));
    console.log(JSON.stringify(parsed, null, 2));
    
    // Analyze the content
    if (parsed.what) {
      console.log(chalk.cyan(`📋 Message type: "${parsed.what}"`));
    }
    
    if (parsed.value || parsed.data) {
      const stats = parsed.value || parsed.data;
      console.log(chalk.magenta('📊 Stats found:'));
      
      // Show key stats
      const keyStats = {
        sessions: stats.sessions,
        users: stats.users,
        syncLifePoints: stats.syncLifePoints,
        walletLifePoints: stats.walletLifePoints,
        syncLifeTraffic: stats.syncLifeTraffic,
        bytesIn: stats.bytesIn,
        bytesOut: stats.bytesOut,
        proxyConnectionState: stats.proxyConnectionState,
        availability: stats.availability,
        reliability: stats.reliability,
        efficiency: stats.efficiency,
        isEarning: stats.isEarning
      };
      
      Object.entries(keyStats).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          console.log(chalk.white(`  ${key}: ${value}`));
        }
      });
    }
    
    // Check for real vs fake data indicators
    const dataQuality = analyzeDataQuality(parsed);
    console.log(chalk.yellow(`🔍 Data quality assessment: ${dataQuality}`));
    
  } catch (error) {
    console.log(chalk.red('❌ Failed to parse JSON:'), error.message);
  }
  
  console.log(chalk.gray('─'.repeat(60)));
});

ws.on('error', (error) => {
  console.log(chalk.red('❌ WebSocket error:'), error.message);
  
  if (error.code === 'ECONNREFUSED') {
    console.log(chalk.yellow('\n💡 Troubleshooting:'));
    console.log(chalk.gray('1. Make sure synchronizer container is running: docker ps'));
    console.log(chalk.gray('2. Check if port 3333 is exposed: docker port <container-name>'));
    console.log(chalk.gray('3. Verify container started with: -p 3333:3333'));
  }
});

ws.on('close', (code, reason) => {
  console.log(chalk.yellow(`\n🔌 WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason given'}`));
  console.log(chalk.blue(`📊 Total messages received: ${messageCount}`));
  process.exit(0);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Stopping WebSocket test...'));
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  } else {
    process.exit(0);
  }
});

// Timeout after 30 seconds if no messages
setTimeout(() => {
  if (messageCount === 0) {
    console.log(chalk.red('\n⏰ No messages received after 30 seconds'));
    console.log(chalk.yellow('The container might not be responding to WebSocket requests'));
    ws.close();
  }
}, 30000);

/**
 * Analyzes WebSocket data quality to determine if real activity is present
 * @function analyzeDataQuality
 * @param {Object} data - WebSocket response data to analyze
 * @returns {string} Quality assessment message with emoji indicators
 * @complexity O(1) - Fixed number of field checks
 * @description Checks for:
 * - Non-zero sessions and users (real activity)
 * - Lifetime points (earning history)
 * - Network traffic (bytes in/out)
 * - Connection state validity
 * Returns categorized assessment:
 * - ❌ ALL ZEROS - No activity
 * - ⚠️ CONNECTED BUT NO ACTIVITY - Waiting state
 * - ✅ REAL ACTIVITY DETECTED - Active sessions
 * - ✅ LIFETIME POINTS DETECTED - Has earnings
 * - ❔ UNCLEAR - Ambiguous data
 */
function analyzeDataQuality(data) {
  const stats = data.value || data.data || data;
  
  if (!stats || typeof stats !== 'object') {
    return 'No stats data found';
  }
  
  // Check for signs of real data
  const hasNonZeroSessions = (stats.sessions && stats.sessions > 0);
  const hasNonZeroUsers = (stats.users && stats.users > 0);
  const hasLifePoints = (stats.syncLifePoints && stats.syncLifePoints > 0) || (stats.walletLifePoints && stats.walletLifePoints > 0);
  const hasTraffic = (stats.bytesIn && stats.bytesIn > 0) || (stats.bytesOut && stats.bytesOut > 0);
  const hasConnectionState = stats.proxyConnectionState && stats.proxyConnectionState !== 'UNKNOWN';
  
  // Check for signs of fake data
  const allZeros = !hasNonZeroSessions && !hasNonZeroUsers && !hasLifePoints && !hasTraffic;
  const onlyConnectedState = hasConnectionState && !hasNonZeroSessions && !hasNonZeroUsers;
  
  if (allZeros) {
    return '❌ ALL ZEROS - No real activity detected';
  } else if (onlyConnectedState) {
    return '⚠️  CONNECTED BUT NO ACTIVITY - May be waiting for traffic';
  } else if (hasNonZeroSessions || hasNonZeroUsers) {
    return '✅ REAL ACTIVITY DETECTED - Has active sessions/users';
  } else if (hasLifePoints) {
    return '✅ LIFETIME POINTS DETECTED - Has earning history';
  } else {
    return '❔ UNCLEAR - Data present but quality uncertain';
  }
}

console.log(chalk.gray('Press Ctrl+C to stop the test\n')); 