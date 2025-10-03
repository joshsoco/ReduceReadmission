import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import Admin from './src/models/Admin.js';
//example lang ng db...
dotenv.config();

connectDB();

const createAnotherSampleAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: 'superadmin2@example.com' });
    
    if (existingAdmin) {
      console.log('Another sample admin already exists:');
      console.log(`Email: superadmin2@example.com`);
      console.log(`Password: admin456`);
      console.log(`Role: superadmin`);
      process.exit(0);
    }

    // Create a new super admin
    const superAdmin = await Admin.create({
      name: 'Super Admin 2',
      email: 'superadmin2@example.com',
      password: 'admin456',
      role: 'superadmin'
    });

    console.log('Another sample super admin created successfully!');
    console.log(`Email: superadmin2@example.com`);
    console.log(`Password: admin456`);
    console.log(`Role: superadmin`);
    console.log(`ID: ${superAdmin._id}`);
    
    // Also create a regular admin
    const regularAdmin = await Admin.create({
      name: 'Admin User 2',
      email: 'admin3@example.com',
      password: 'admin456',
      role: 'admin'
    });

    console.log('Another regular admin created successfully!');
    console.log(`Email: admin3@example.com`);
    console.log(`Password: admin456`);
    console.log(`Role: admin`);
    console.log(`ID: ${regularAdmin._id}`);

    // Create another sample user
    const User = (await import('./src/models/User.js')).default;
    const user = await User.create({
      name: 'Jane Doe',
      email: 'user2@example.com',
      password: 'user456'
    });

    console.log('Another sample user created successfully!');
    console.log(`Email: user2@example.com`);
    console.log(`Password: user456`);
    console.log(`ID: ${user._id}`);

    console.log('You can now test the API endpoints!');
    
    process.exit(0);

  } catch (error) {
    console.error('Error creating another admin:', error.message);
    process.exit(1);
  }
};

createAnotherSampleAdmin();
