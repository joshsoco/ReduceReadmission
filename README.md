# Hospital Readmission Prediction System

A comprehensive MERN stack application for predicting hospital readmission risks with role-based access control, manual patient data entry, and ML-powered prediction algorithms.

## 🚀 Features

### Core Functionality
- **Admin Authentication System** with JWT tokens and refresh token rotation
- **Role-Based Access Control** (Nurse, Doctor, Admin, SuperAdmin)
- **Manual Patient Data Entry** with 17+ clinical fields
- **Readmission Risk Prediction** using ML-based algorithm
- **Excel Data Upload** for bulk patient data import
- **Recent Entries Management** with CRUD operations
- **Export to PDF** for patient reports
- **Rate Limiting & Security** middleware protection

### Manual Entry Features
- 📋 **Patient Demographics**: ID, Name, Age, Gender, Admission/Discharge dates
- 🩺 **Diagnosis Information**: Primary/Secondary diagnoses, procedures, medications
- 📊 **Clinical Data**: BP, glucose, A1C, weight, BMI, notes
- 🎯 **Risk Prediction**: Real-time readmission risk scoring (High/Medium/Low)
- 💾 **Save Records**: Doctor and Admin can save predictions
- 🗑️ **Delete Entries**: Admin-only deletion capabilities
- 📥 **Sample Data**: Quick testing with pre-filled data
- 📤 **Export Reports**: PDF generation for patient records

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite 7.1.8** for fast builds and HMR
- **TailwindCSS 4.1.14** for styling
- **shadcn/ui** component library
- **lucide-react** for icons
- **React Router** for navigation

### Backend
- **Node.js** with Express.js
- **MongoDB** for database
- **JWT** for authentication
- **express-validator** for validation
- **Upstash Redis** for rate limiting
- **bcrypt** for password hashing

### Python Services
- **FastAPI** for ML model serving
- **Flask** alternative option
- Machine Learning model integration

## 📁 Project Structure

```
AdminTemplate_MERN/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   ├── Navbar.tsx
│   │   │   └── ProtectedRoutes.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── components/
│   │   │   │   │   └── LoginForm.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useLoginViewModel.ts
│   │   │   │   └── services/
│   │   │   │       └── authService.ts
│   │   │   └── manual-entry/
│   │   │       ├── models/
│   │   │       │   └── patientModel.ts
│   │   │       ├── services/
│   │   │       │   └── manualEntryService.ts
│   │   │       └── hooks/
│   │   │           └── useManualEntry.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   └── ManualEntry.tsx
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # MongoDB connection
│   │   │   └── upstash.js         # Redis rate limiting
│   │   ├── controller/
│   │   │   ├── adminController.js
│   │   │   ├── loginController.js
│   │   │   ├── uploadController.js
│   │   │   └── manualEntryController.js
│   │   ├── middleware/
│   │   │   ├── accessLimiter.js   # Auth middleware
│   │   │   └── rateLimiter.js     # Rate limiting
│   │   ├── models/
│   │   │   ├── Admin.js
│   │   │   └── Login.js
│   │   ├── routes/
│   │   │   └── routes.js
│   │   ├── python/
│   │   │   ├── app.py
│   │   │   ├── fastAPI.py
│   │   │   └── main.py
│   │   └── server.js
│   ├── create-admin.js
│   └── package.json
└── README.md
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ installed
- MongoDB running locally or MongoDB Atlas account
- Redis (Upstash) account for rate limiting
- Python 3.8+ (for ML services)

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/joshsoco/ReduceReadmission.git
cd AdminTemplate_MERN
```

#### 2. Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in `backend/` directory:
```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/hospital_admin
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hospital_admin

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_URL=your-upstash-redis-url
UPSTASH_REDIS_TOKEN=your-upstash-redis-token

# CORS
FRONTEND_URL=http://localhost:5173
```

#### 3. Create Initial Admin
```bash
node create-admin.js
```

#### 4. Start Backend Server
```bash
npm start
# or for development with nodemon:
npm run dev
```

Backend will run on `http://localhost:5000`

#### 5. Frontend Setup
```bash
cd frontend
npm install
```

Create `.env` file in `frontend/` directory:
```env
VITE_API_URL=http://localhost:5000/api
```

#### 6. Start Frontend Development Server
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

#### 7. Python ML Service (Optional)
```bash
cd backend/src/python
pip install -r requirements.txt
python fastAPI.py
# or
python app.py
```

## 🔐 User Roles & Permissions

| Feature | Nurse | Doctor | Admin | SuperAdmin |
|---------|-------|--------|-------|------------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Predict Readmission | ✅ | ✅ | ✅ | ✅ |
| Save Manual Entry | ❌ | ✅ | ✅ | ✅ |
| View Recent Entries | ✅ | ✅ | ✅ | ✅ |
| Delete Entries | ❌ | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ❌ | ✅ |
| Upload Excel Data | ❌ | ✅ | ✅ | ✅ |
| Export Reports | ✅ | ✅ | ✅ | ✅ |

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/admin/login      - Admin login
GET    /api/auth/me               - Get current user
POST   /api/auth/logout           - Logout
POST   /api/auth/refresh          - Refresh JWT token
```

### Admin Management
```
GET    /api/admin/profile         - Get admin profile
PUT    /api/admin/profile         - Update profile
PUT    /api/admin/change-password - Change password
GET    /api/admin/all             - Get all admins (SuperAdmin only)
POST   /api/admin/create          - Create admin (SuperAdmin only)
PUT    /api/admin/:id/status      - Update admin status (SuperAdmin only)
DELETE /api/admin/:id             - Delete admin (SuperAdmin only)
```

### Manual Entry
```
POST   /api/manual-entry/predict  - Get readmission prediction
POST   /api/manual-entry/save     - Save manual entry (Doctor/Admin)
GET    /api/manual-entry/recent   - Get recent entries
DELETE /api/manual-entry/:id      - Delete entry (Admin only)
```

### File Upload
```
POST   /api/upload/excel          - Upload Excel file with patient data
```

### Health Check
```
GET    /api/health                - Check API status
GET    /api/info                  - Get API information
```

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run test
```

### Backend Testing
```bash
cd backend
npm run test
```

### Manual Testing
1. Login with admin credentials
2. Navigate to Manual Entry page
3. Click "Use Sample Data" to load test data
4. Click "Predict Readmission" to see risk assessment
5. Save the entry (if you have doctor/admin role)

## 🏗️ Risk Prediction Algorithm

The system uses a multi-factor risk scoring algorithm:

### Risk Factors:
- **Age**: 65+ (+2 points), 50+ (+1 point)
- **Admission Type**: Emergency (+2), Urgent (+1)
- **Procedures**: 5+ (+2), 2+ (+1)
- **Medications**: 10+ (+2), 5+ (+1)
- **Glucose Level**: 180+ (+2), 140+ (+1)
- **A1C Result**: 7.0+ (+2), 6.5+ (+1)
- **BMI**: 30+ (+1)

### Risk Classification:
- **High Risk (≥60%)**: Intensive follow-up, 7-day appointment
- **Medium Risk (35-59%)**: Standard follow-up, 14-day appointment
- **Low Risk (<35%)**: Routine follow-up, 30-day appointment

## 🔒 Security Features

- JWT token authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Role-based access control (RBAC)
- Input validation with express-validator
- CORS protection
- XSS protection
- SQL injection prevention

## 📊 Rate Limits

- **Auth endpoints**: 5 requests/15 minutes per IP
- **API endpoints**: 100 requests/15 minutes per IP
- **General endpoints**: 200 requests/15 minutes per IP
- **Strict endpoints**: 3 requests/15 minutes per IP

## 🎨 UI Components

Built with **shadcn/ui**:
- `Button` - Primary actions
- `Input` - Form fields
- `Label` - Form labels
- `Card` - Content containers
- `Alert` - Error/success messages
- `Badge` - Risk level indicators
- `Checkbox` - Boolean inputs

## 🚀 Deployment

### Frontend Deployment (Vercel/Netlify)
```bash
cd frontend
npm run build
# Deploy the 'dist' folder
```

### Backend Deployment (Railway/Heroku/Render)
```bash
cd backend
# Set environment variables in your hosting platform
# Deploy from GitHub or push directly
```

### Environment Variables
Ensure all production environment variables are set:
- `MONGODB_URI` - Production MongoDB connection
- `JWT_SECRET` - Strong secret key
- `UPSTASH_REDIS_URL` - Redis URL
- `FRONTEND_URL` - Production frontend URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Code Style

- **Frontend**: ESLint + Prettier with TypeScript
- **Backend**: ESLint with ES6 modules
- **Formatting**: 2 spaces indentation
- **Naming**: camelCase for variables, PascalCase for components

## 🐛 Known Issues & TODOs

- [ ] Connect to actual ML model for predictions (currently using mock algorithm)
- [ ] Implement full PDF export functionality
- [ ] Add MongoDB models for manual entry persistence
- [ ] Add unit tests for all controllers
- [ ] Add E2E tests with Cypress/Playwright
- [ ] Implement real-time notifications
- [ ] Add data visualization dashboard
- [ ] Integrate with EHR systems

## 📖 Documentation

- [Manual Entry Implementation Details](./MANUAL_ENTRY_IMPLEMENTATION.md)
- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

- **Repository Owner**: Josh Soco ([@joshsoco](https://github.com/joshsoco))
- **Project**: ReduceReadmission

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Contact: [Your contact information]

## 🙏 Acknowledgments

- **shadcn/ui** for beautiful UI components
- **TailwindCSS** for utility-first styling
- **MongoDB** for database
- **Express.js** for backend framework
- **React** for frontend framework

---

**Built with ❤️ for better healthcare outcomes**

Last Updated: October 16, 2025
