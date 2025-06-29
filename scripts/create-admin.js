// scripts/create-admin.js
const fileDb = require('../services/fileDb');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function createAdmin(username, name, email, password) {
  try {
    // Check if admins file exists and initialize if needed
    await fileDb.initializeDatabase();
    
    // Check if admin already exists
    const admins = await fileDb.read('admins');
    const existingAdmin = admins.find(a => a.username === username);
    
    if (existingAdmin) {
      console.log(`Admin ${username} already exists.`);
      return;
    }
    
    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create admin record
    const now = Date.now();
    const adminId = `admin_${now}_${crypto.randomBytes(3).toString('hex')}`;
    
    const adminRecord = {
      id: adminId,
      username,
      passwordHash,
      isDefaultPassword: true,
      name,
      email,
      role: 'admin',
      "permissions": ["view_results"],
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    // Store admin record
    await fileDb.create('admins', adminRecord);
    
    console.log(`Admin ${username} created successfully.`);
  } catch (err) {
    console.error('Error creating admin:', err);
  }
}

// Example usage
async function main() {
  if (process.argv.length < 6) {
    console.log('Usage: node create-admin.js <username> <name> <email> <password>');
    return;
  }
  
  const username = process.argv[2];
  const name = process.argv[3];
  const email = process.argv[4];
  const password = process.argv[5];
  
  await createAdmin(username, name, email, password);
}

main().catch(console.error);