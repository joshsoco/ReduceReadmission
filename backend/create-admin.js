import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import Admin from './src/models/Admin.js';

dotenv.config();

connectDB();

const createInitialAdmin = async () => {
  try {
    // Check if any admin exists
    const existingAdmin = await Admin.findOne();
    
    if (existingAdmin) {
      console.log('Admin accounts already exist in the database.');
      console.log('Use the manual admin creation script if you need to create additional admins.');
      process.exit(0);
    }

    // Create initial super admin
    const superAdmin = await Admin.create({
      name: 'Super Administrator',
      email: 'admin1@gmail.com',
      password: 'admin123!',
      role: 'superadmin'
    });

    console.log('Initial Super Admin created successfully!');
    console.log('==========================================');
    console.log(`Email: superadmin@admin.com`);
    console.log(`Password: SuperAdmin123!`);
    console.log(`Role: superadmin`);
    console.log(`ID: ${superAdmin._id}`);
    console.log('==========================================');
    console.log('IMPORTANT: Change the password immediately after first login!');
    console.log('Use this account to create additional admins through the admin panel.');
    
    process.exit(0);

  } catch (error) {
    console.error('Error creating initial admin:', error.message);
    process.exit(1);
  }
};

createInitialAdmin();
