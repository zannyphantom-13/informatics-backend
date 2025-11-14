// Simple test script to register a new user with security question
const http = require('http');

const testUser = {
  full_name: 'John Doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
  phone_number: '+1234567890',
  date_of_birth: '1995-05-15',
  country: 'USA',
  bio: 'Test user for security question feature',
  security_question: 'childhood_pet',
  security_answer: 'Fluffy'
};

const postData = JSON.stringify(testUser);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n✅ Registration Response:');
    console.log('Status:', res.statusCode);
    console.log('Response:', JSON.parse(data));
  });
});

req.on('error', (e) => {
  console.error('❌ Error:', e.message);
  console.error('Full error:', e);
});

console.log('📤 Sending registration request...');
console.log('User:', testUser);
req.write(postData);
req.end();
