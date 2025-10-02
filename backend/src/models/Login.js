import moongoose from 'mongoose';

const loginSchema = new moongoose.Schema(
    {
        username: { type: String, required: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['admin'], default: 'admin' },
    },
    { timestamps: true }
);
const Login = moongoose.model('Login', loginSchema);

export default Login;