# Reducing Readmissions: A Predictive System for Hospital Patients

## Project Description
The Hospital Readmission Prediction System aims to help healthcare providers identify patients at high risk of being readmitted shortly after discharge.  
Hospital readmissions are a major concern because they increase healthcare costs, reduce hospital efficiency, and may indicate gaps in patient care.

This project leverages machine learning techniques to analyze patient data (e.g., demographics, diagnoses, length of stay, previous admissions) and predict the likelihood of readmission.  

The system will be trained using publicly available hospital datasets and evaluated with performance metrics such as accuracy, precision, recall, and F1-score.

Expected outcome: A prototype decision-support tool that assists hospitals in taking preventive measures for high-risk patients, including:
- Additional care instructions
- Follow-up scheduling
- Targeted interventions  

---

## Objectives
- Develop a web-based platform application.  
- Create a scalable and secure database for storing and retrieving patient data.  
- Design an intuitive and user-friendly interface for both web and mobile users.  

---

## Target Users
- Doctors / Physicians  
- Nurses / Hospital Staff  
- Hospital Administrators  

---

## System Features
- Secure role-based login  
- Input patient details (manual entry or CSV/Excel upload)  
- Patient detail display & prediction results  
- Prediction probability dashboard  
- Storing and filtering of records  
- Backup and recovery mechanisms  
- Scalable schema for future growth  

---

## Technologies & Tools
**Frontend**  
- React  

**Backend**  
- Node.js  

**Database**  
- PostgreSQL / MySQL / MongoDB  

**Version Control**  
- GitHub / GitLab  

**Design Tools**  
- Figma  

---

## Scope
- Web application with role-based access  
- Patient prediction system with dashboard insights  
- Data storage, filtering, and reporting  

---

## Project Setup
```bash
# Clone repository
git clone https://github.com/joshsoco/ReduceReadmission.git

# Navigate to project folder
cd ReduceReadmission

# Install dependencies
npm install

# Run development server
npm start
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
