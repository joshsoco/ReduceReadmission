import React from 'react';
import { Info, Heart, Target, Award, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">About Us</h1>
          <p className="text-gray-600">
            Learn more about our Hospital Readmission Prediction System
          </p>
        </div>

        {}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              Our mission is to reduce hospital readmissions by providing healthcare professionals
              with advanced predictive analytics tools. We leverage machine learning and data science
              to identify patients at high risk of readmission, enabling proactive interventions and
              improved patient outcomes.
            </p>
          </CardContent>
        </Card>

        {}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-6 h-6 text-green-600" />
              About the System
            </CardTitle>
            <CardDescription>
              Powered by advanced machine learning algorithms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What We Do</h3>
              <p className="text-gray-700 leading-relaxed">
                The Hospital Readmission Prediction System analyzes patient data to predict the
                likelihood of hospital readmission within 30 days of discharge. Our system processes
                multiple factors including patient demographics, medical history, diagnosis codes,
                and treatment patterns to generate accurate risk assessments.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">How It Works</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                  <span>Upload patient data in Excel format or enter manually</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                  <span>Our ML model analyzes multiple risk factors</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                  <span>Receive instant risk predictions and recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                  <span>Track trends and monitor patient outcomes</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-600" />
              Key Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Accurate Predictions</h4>
                <p className="text-sm text-blue-700">
                  94%+ accuracy in predicting readmission risk
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Real-time Analysis</h4>
                <p className="text-sm text-green-700">
                  Instant risk assessment for timely interventions
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-2">Easy Integration</h4>
                <p className="text-sm text-purple-700">
                  Upload Excel files or enter data manually
                </p>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-2">Comprehensive Reports</h4>
                <p className="text-sm text-orange-700">
                  Detailed analytics and trend visualization
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-6 h-6 text-red-600" />
              Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Improved Patient Outcomes</h4>
                  <p className="text-sm text-gray-600">
                    Early identification of high-risk patients enables proactive care
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Reduced Healthcare Costs</h4>
                  <p className="text-sm text-gray-600">
                    Lower readmission rates mean reduced costs for hospitals and patients
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Enhanced Decision Making</h4>
                  <p className="text-sm text-gray-600">
                    Data-driven insights support better clinical decisions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-purple-600 font-bold text-sm">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Resource Optimization</h4>
                  <p className="text-sm text-gray-600">
                    Allocate healthcare resources more effectively
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              Get in Touch
            </CardTitle>
            <CardDescription>
              Have questions? We're here to help
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-gray-700">
              <p>
                <strong>Email:</strong> itlogjoshua585@gmail.com
              </p>
              <p>
                <strong>Support Hours:</strong> Every time i want
              </p>
              <p className="text-sm text-gray-600 pt-3 border-t">
                For technical support or questions about using the system, please contact our
                support team or refer to the documentation in the Help section.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
