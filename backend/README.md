
### Authentication & Authorization
- **JWT-based authentication**
 with role-based access control
- **Admin login** 
with super admin and 
regular admin roles  
- **User login** for regular users
- **Secure password hashing** using bcrypt
- **Login history tracking** with IP address and user agent logging
- **Token refresh** functionality
- **Graceful logout** handling

### 👥 User Management (Admin Only)
- **Full CRUD operations** for users
- **User pagination and filtering** with search capabilities
- **User statistics** and analytics
- **User status management** (activate/deactivate)
- **Soft delete** vs hard delete options

### 👤 Admin Management (Super Admin Only)
- **Admin profile management**
- **Password change** with current password verification
- **Create new admins** with role assignment
- **Admin status management**
- **Admin deletion** (cannot delete own account)

### 🛡️ Security & Rate Limiting
- **Redis-based rate limiting** with in-memory fallback
- **Different rate limits** for different endpoint types
- **IP-based rate limiting** for authentication attempts
- **CORS protection** with configurable origins
- **Security headers** with Helmet.js
- **Request validation** using express-validator

### 📊 Monitoring & Logging
- **Health check endpoints**
- **API documentation** endpoint
- **Morgan logging** for HTTP requests
- **Comprehensive error handling**
- **Graceful shutdown** handling

## 📁 Project Structure

===============================================
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── upstash.js         # Redis configuration
│   ├── controller/
│   │   ├── accountController.js    # User CRUD operations
│   │   ├── adminController.js      # Admin management
│   │   └── loginController.js      # Authentication
│   ├── middleware/
│   │   ├── accessLimiter.js        # JWT auth middleware
│   │   └── rateLimiter.js          # Rate limiting
│   ├── models/
│   │   ├── Admin.js               # Admin schema
│   │   ├── Login.js               # Login history schema
│   │   └── User.js                # User schema
│   ├── routes/
│   │   └── routes.js              # API routes
│   └── server.js                  # Express app setup
├── .env                           # Environment variables
├── package.json                   # Dependencies
└── create-admin.js               # Admin seeding script
===============================================
## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Redis (optional, for production rate limiting)

### 1. Clone and Install
```bash
git clone <repository-url>
cd backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the backend directory:

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/admin_template

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Redis Configuration (Optional - for production)
UPSTASH_REDIS_REST_URL=https://your-upstash-redis-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
```

### 3. Database Setup
Make sure MongoDB is running on your system.

### 4. Create Sample Data
```bash
node create-admin.js
```

This creates:
- **Super Admin**: admin@example.com / admin123
- **Regular Admin**: admin2@example.com / admin123  
- **Sample User**: user@example.com / user123

### 5. Start Development Server
```bash
npm run dev
```

The server will start on http://localhost:5000

## 📚 API Documentation

### Authentication Endpoints

#### Admin Login
```http
POST /api/auth/admin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### User Login  
```http
POST /api/auth/user/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "user123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer <jwt_token>
```

### Admin Management (Super Admin Only)

#### Get Admin Profile
```http
GET /api/admin/profile
Authorization: Bearer <admin_jwt_token>
```

#### Update Admin Profile
```http
PUT /api/admin/profile
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

#### Change Password
```http
PUT /api/admin/change-password
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "currentPassword": "admin123",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

#### Get All Admins
```http
GET /api/admin/all?page=1&limit=10&search=admin&role=admin
Authorization: Bearer <superadmin_jwt_token>
```

#### Create New Admin
```http
POST /api/admin/create
Authorization: Bearer <superadmin_jwt_token>
Content-Type: application/json

{
  "name": "New Admin",
  "email": "newadmin@example.com",
  "password": "password123",
  "role": "admin"
}
```

### User Management (Admin Only)

#### Get All Users
```http
GET /api/users?page=1&limit=10&search=john&isActive=true
Authorization: Bearer <admin_jwt_token>
```

#### Get User by ID
```http
GET /api/users/:userId
Authorization: Bearer <admin_jwt_token>
```

#### Create User
```http
POST /api/users
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "isActive": true
}
```

#### Update User
```http
PUT /api/users/:userId
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com",
  "isActive": false
}
```

#### Delete User
```http
DELETE /api/users/:userId?hardDelete=false
Authorization: Bearer <admin_jwt_token>
```

#### Get User Statistics
```http
GET /api/users/stats
Authorization: Bearer <admin_jwt_token>
```

### Utility Endpoints

#### Health Check
```http
GET /health
```

#### API Information
```http
GET /api/info
```

## 🔒 Security Features

### Rate Limiting
- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes per IP+Email
- **Strict Operations**: 10 requests per hour
- **API Operations**: 60 requests per minute

### JWT Token Structure
```json
{
  "id": "user_or_admin_id",
  "email": "user@example.com",
  "userType": "Admin|User", 
  "role": "superadmin|admin|user",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Password Requirements
- Minimum 6 characters
- Automatically hashed with bcrypt (10 rounds)
- Current password verification for changes

## 🚀 Production Deployment

### Environment Variables
Update `.env` for production:

```env
NODE_ENV=production
JWT_SECRET=your_production_jwt_secret_256_bit_key
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
UPSTASH_REDIS_REST_URL=https://your-production-redis-url
UPSTASH_REDIS_REST_TOKEN=your-production-redis-token
FRONTEND_URL=https://yourdomain.com
```

### Performance Recommendations
1. **Use Redis** for production rate limiting
2. **Set up MongoDB indexes** for better query performance
3. **Enable MongoDB Atlas** for managed database
4. **Use PM2** for process management
5. **Set up reverse proxy** (nginx) for better performance
6. **Enable SSL/TLS** certificates

### Security Recommendations
1. **Change default admin credentials** immediately
2. **Use strong JWT secrets** (256-bit minimum)
3. **Enable database authentication**
4. **Set up firewall rules**
5. **Regular security updates**

## 🧪 Testing

### Manual Testing with curl/Postman

1. **Login as Admin:**
```bash
curl -X POST http://localhost:5000/api/auth/admin/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@example.com","password":"admin123"}'
```

2. **Get Users (use token from login):**
```bash
curl -X GET http://localhost:5000/api/users \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Create User:**
```bash
curl -X POST http://localhost:5000/api/users \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test User","email":"test@example.com","password":"test123"}'
```

## 📈 Monitoring & Debugging

### Log Levels
- **Development**: Detailed logs with stack traces
- **Production**: Essential logs only

### Health Check Response
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2023-10-01T12:00:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "rss": 64262144,
    "heapTotal": 28073984,
    "heapUsed": 24210552
  },
  "pid": 12345
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

**Happy coding!** 🚀