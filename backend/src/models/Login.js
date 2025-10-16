import mongoose from 'mongoose';

const loginSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Admin'
    },
    userType: {
        type: String,
        required: true,
        enum: ['Admin'],
        default: 'Admin'
    },
    email: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        default: null
    },
    loginStatus: {
        type: String,
        enum: ['success', 'failed'],
        required: true
    },
    failureReason: {
        type: String,
        default: null
    },
    location: {
        country: String,
        city: String,
        timezone: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

loginSchema.index({ userId: 1, createdAt: -1 });
loginSchema.index({ ipAddress: 1, createdAt: -1 });
loginSchema.index({ email: 1, createdAt: -1 });

const Login = mongoose.model('Login', loginSchema);

export default Login;
