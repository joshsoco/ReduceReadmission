// Libraries
import express from 'express';

// Functions
import {getAllUsers, getUserById, createUser, updateUser, deleteUser} from '../controller/accountController.js';
import {login} from '../controller/loginController.js';
import {adminAuth} from '../middleware/accessLimiter.js';
import {getCurrentAdmin, updateAdminProfile, changeAdminPassword} from '../controller/adminController.js';

const router = express.Router();

// Admin Login route
router.post('/login', login);

// User Management routes
router.get('/', adminAuth, getAllUsers);
router.post('/', adminAuth, createUser);
router.get('/:id', adminAuth, getUserById);
router.put('/:id', adminAuth, updateUser);
router.delete('/:id', adminAuth, deleteUser);

// Current Admin route to fetch admin details
router.get('/me', adminAuth, getCurrentAdmin);
router.put('/me', adminAuth, updateAdminProfile);
router.put('/me/password', adminAuth, changeAdminPassword);

export default router;
