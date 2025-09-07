"use client";
import { useAuth } from "../../AuthProvider";

export default function ITOverviewPage() {
  const { userProfile } = useAuth();

  const isSuperAdmin = userProfile?.role === "superAdmin";

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-2">IT Overview</h1>
        <p className="text-gray-600">Access denied – this page is only available to superAdmin users.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-[#e40115] mb-6">LoxConnect PRO – Complete System Overview</h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
        <p className="text-blue-800">
          <strong>For Business Leaders:</strong> This page explains what LoxConnect PRO does, how it's built, and why it's secure and reliable for your business operations.
        </p>
      </div>

      {/* What LoxConnect PRO Does */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🎯 What LoxConnect PRO Does</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-4">
            <strong>LoxConnect PRO is your centralized platform for managing equipment rental quotes across all countries.</strong>
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">For Sales Teams:</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Create quote requests for customers in any country</li>
                <li>Track quote status from "New" to "Won/Lost"</li>
                <li>Communicate with other countries in real-time</li>
                <li>Share files and documents instantly</li>
                <li>See which quotes are urgent or need attention</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">For Management:</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>View analytics: won quotes, revenue, customer performance</li>
                <li>Monitor which countries are most active</li>
                <li>Track conversion rates and pipeline health</li>
                <li>Manage user access and permissions</li>
                <li>Ensure data security and compliance</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🔧 Technology Stack</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-4">
            <strong>Built with modern, enterprise-grade technology:</strong>
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-blue-800">Frontend</h3>
              </div>
              <p className="text-sm text-gray-600">Next.js, TypeScript, Tailwind CSS</p>
              <p className="text-xs text-gray-500 mt-1">Fast, reliable, mobile-friendly interface</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-green-800">Backend</h3>
              </div>
              <p className="text-sm text-gray-600">Firebase (Google)</p>
              <p className="text-xs text-gray-500 mt-1">Real-time data, authentication, file storage</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-purple-800">Hosting</h3>
              </div>
              <p className="text-sm text-gray-600">Vercel (Automatic)</p>
              <p className="text-xs text-gray-500 mt-1">Global CDN, instant deployments</p>
            </div>
          </div>
        </div>
      </section>

      {/* Closed System Architecture */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🏢 Multi-ERP Compatibility & Closed System Architecture</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              <strong>LoxConnect PRO works with ANY ERP system - no integration required!</strong>
            </p>
            <p className="text-gray-600 text-sm mb-4">
              Each Business Unit can use their own ERP system without any technical dependencies or API connections.
            </p>
          </div>
          
          {/* Visual Architecture Diagram */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4 text-center">🏗️ System Architecture</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Side - ERP Systems */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-center">Business Units & Their ERP Systems</h4>
                <div className="space-y-3">
                  <div className="bg-blue-100 rounded-lg p-3 text-center">
                    <div className="font-semibold text-blue-800">Loxcall Netherlands</div>
                    <div className="text-sm text-blue-600">Local ERP System</div>
                  </div>
                  <div className="bg-green-100 rounded-lg p-3 text-center">
                    <div className="font-semibold text-green-800">Loxcall Germany</div>
                    <div className="text-sm text-green-600">Local ERP System</div>
                  </div>
                  <div className="bg-purple-100 rounded-lg p-3 text-center">
                    <div className="font-semibold text-purple-800">Loxcall France</div>
                    <div className="text-sm text-purple-600">Local ERP System</div>
                  </div>
                  <div className="bg-yellow-100 rounded-lg p-3 text-center">
                    <div className="font-semibold text-yellow-800">Ramirent Finland</div>
                    <div className="text-sm text-yellow-600">Local ERP System</div>
                  </div>
                </div>
              </div>
              
              {/* Right Side - LoxConnect PRO */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-center">LoxConnect PRO</h4>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
                  <div className="font-semibold text-red-800 text-lg mb-2">🔒 CLOSED SYSTEM</div>
                  <div className="text-sm text-red-600 mb-3">No External Dependencies</div>
                  <div className="space-y-2 text-xs text-red-700">
                    <div>✅ No ERP API connections</div>
                    <div>✅ No external email providers</div>
                    <div>✅ No third-party AI services</div>
                    <div>✅ No external data sources</div>
                    <div>✅ Self-contained & secure</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Connection Arrows */}
            <div className="flex justify-center items-center mt-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-0.5 bg-gray-400"></div>
                <div className="text-gray-500 text-sm">Manual Data Entry</div>
                <div className="w-8 h-0.5 bg-gray-400"></div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-green-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-green-800">🛡️ Security</h3>
              </div>
              <p className="text-sm text-gray-600">No external connections = no attack vectors</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-blue-800">🔄 Flexibility</h3>
              </div>
              <p className="text-sm text-gray-600">Works with any ERP system</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-purple-800">⚡ Reliability</h3>
              </div>
              <p className="text-sm text-gray-600">No dependency on external services</p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Data Protection */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🛡️ Security & Data Protection</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Authentication & Access Control</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li><strong>Email/Password:</strong> Secure login with Firebase Auth</li>
                <li><strong>Multi-Factor Authentication:</strong> Optional 2FA for extra security</li>
                <li><strong>Role-Based Access:</strong> Employees, Admins, SuperAdmins have different permissions</li>
                <li><strong>Country Isolation:</strong> Users only see data from their assigned countries</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Advanced Security Features</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li><strong>App Check:</strong> Prevents automated attacks and fraud</li>
                <li><strong>Session Security:</strong> Secure cookies, automatic logout</li>
                <li><strong>Data Encryption:</strong> All data encrypted in transit and at rest</li>
                <li><strong>Audit Trail:</strong> Complete log of all user actions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Data Backup & Recovery */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">💾 Data Backup & Recovery</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-4">
            <strong>Your data is protected with multiple layers of backup:</strong>
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-yellow-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-yellow-800">Point-in-Time Recovery</h3>
              </div>
              <p className="text-sm text-gray-600">7 days automatic</p>
              <p className="text-xs text-gray-500 mt-1">Recover from accidental deletions or mistakes</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-green-800">Daily Backups</h3>
              </div>
              <p className="text-sm text-gray-600">30 days retention</p>
              <p className="text-xs text-gray-500 mt-1">Long-term disaster recovery protection</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-blue-800">Archiving System</h3>
              </div>
              <p className="text-sm text-gray-600">Cost optimization</p>
              <p className="text-xs text-gray-500 mt-1">Old data moved to cheaper storage</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <p className="text-green-800 text-sm">
              <strong>✅ Current Status:</strong> All backup systems are active and protecting your data 24/7.
            </p>
          </div>
        </div>
      </section>

      {/* User Roles & Permissions */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">👥 User Roles & Permissions</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">👤 Employee</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Create and manage quote requests</li>
                <li>• Send messages to other countries</li>
                <li>• View analytics for their country</li>
                <li>• Access customer information</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">👨‍💼 Admin</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• All Employee permissions</li>
                <li>• Manage users in their countries</li>
                <li>• Configure notification settings</li>
                <li>• Access user management tools</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">👑 SuperAdmin</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• All Admin permissions</li>
                <li>• Global system access</li>
                <li>• Manage countries and labels</li>
                <li>• Access IT tools and analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">⭐ Key Features</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Real-Time Collaboration</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Instant messaging between countries</li>
                <li>Live status updates and notifications</li>
                <li>File sharing and document collaboration</li>
                <li>Activity tracking and audit trails</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Business Intelligence</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Revenue analytics by country and customer</li>
                <li>Quote conversion tracking</li>
                <li>Customer performance insights</li>
                <li>Pipeline health monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Deployment & Maintenance */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🚀 Deployment & Maintenance</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Automatic Updates</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>Code changes deploy automatically</li>
                <li>Zero-downtime deployments</li>
                <li>Global CDN for fast access worldwide</li>
                <li>Automatic scaling based on usage</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Monitoring & Support</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>24/7 system monitoring</li>
                <li>Automatic error detection and reporting</li>
                <li>Performance optimization</li>
                <li>Regular security updates</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Business Benefits */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">💼 Business Benefits</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-green-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-green-800">Efficiency</h3>
              </div>
              <p className="text-sm text-gray-600">Faster quote processing, reduced email chains, centralized information</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-blue-800">Transparency</h3>
              </div>
              <p className="text-sm text-gray-600">Real-time visibility into quote status, customer interactions, and performance</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-lg p-4 mb-2">
                <h3 className="font-semibold text-purple-800">Scalability</h3>
              </div>
              <p className="text-sm text-gray-600">Grows with your business, handles unlimited users and countries</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact & Support */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">📞 Contact & Support</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">For Technical Issues</h3>
              <p className="text-gray-700 mb-2">Contact the SuperAdmin team for:</p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>System errors or bugs</li>
                <li>User access problems</li>
                <li>Data recovery requests</li>
                <li>Security concerns</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">For Business Questions</h3>
              <p className="text-gray-700 mb-2">Contact your country Admin for:</p>
              <ul className="list-disc ml-6 text-gray-700 space-y-1">
                <li>User training and onboarding</li>
                <li>Process improvements</li>
                <li>Feature requests</li>
                <li>Analytics interpretation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* IT Takeover & Self-Hosting */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">🏠 IT Takeover & Self-Hosting Options</h2>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-4">
            <strong>Complete ownership and control is possible.</strong> If your IT team wants to take over the entire application and host it on your own infrastructure, here's what you need to know:
          </p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-3">✅ What You Get</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1 text-sm">
                <li><strong>Complete Source Code:</strong> Full access to all application code</li>
                <li><strong>Database Export:</strong> All Firestore data can be exported</li>
                <li><strong>Configuration Files:</strong> All settings and environment variables</li>
                <li><strong>Documentation:</strong> Complete technical documentation</li>
                <li><strong>No Vendor Lock-in:</strong> You own everything</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-3">🔧 What You Need</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1 text-sm">
                <li><strong>Server Infrastructure:</strong> Node.js hosting environment</li>
                <li><strong>Database:</strong> MongoDB or PostgreSQL (to replace Firestore)</li>
                <li><strong>File Storage:</strong> AWS S3, Google Cloud Storage, or local storage</li>
                <li><strong>Authentication:</strong> Custom auth system or Auth0</li>
                <li><strong>Domain & SSL:</strong> Your own domain with SSL certificates</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Migration Process</h3>
            <p className="text-gray-700 text-sm mb-2">
              <strong>Step-by-step migration:</strong>
            </p>
            <ol className="list-decimal ml-6 text-gray-700 space-y-1 text-sm">
              <li><strong>Export Data:</strong> Download all Firestore collections as JSON</li>
              <li><strong>Setup Infrastructure:</strong> Deploy servers, database, and storage</li>
              <li><strong>Modify Code:</strong> Replace Firebase services with your chosen alternatives</li>
              <li><strong>Import Data:</strong> Load exported data into your new database</li>
              <li><strong>Test & Deploy:</strong> Verify functionality and go live</li>
            </ol>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-2">💡 Benefits of Self-Hosting</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-green-100 rounded-lg p-3 mb-2">
                  <h4 className="font-semibold text-green-800">🔒 Complete Control</h4>
                </div>
                <p className="text-sm text-gray-600">Full control over data, security, and infrastructure</p>
              </div>
              <div className="text-center">
                <div className="bg-blue-100 rounded-lg p-3 mb-2">
                  <h4 className="font-semibold text-blue-800">💰 Cost Control</h4>
                </div>
                <p className="text-sm text-gray-600">No monthly SaaS fees, only infrastructure costs</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-lg p-3 mb-2">
                  <h4 className="font-semibold text-purple-800">🔧 Customization</h4>
                </div>
                <p className="text-sm text-gray-600">Modify and extend the system as needed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Details (Collapsible) */}
      <details className="mb-8">
        <summary className="text-xl font-semibold mb-4 text-gray-800 cursor-pointer hover:text-[#e40115]">
          🔧 Technical Details (For IT Teams)
        </summary>
        <div className="bg-gray-50 border rounded-lg p-6 mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Architecture</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1 text-sm">
                <li>Next.js 15.3.4 with App Router</li>
                <li>TypeScript for type safety</li>
                <li>Tailwind CSS for styling</li>
                <li>Firebase Firestore for database</li>
                <li>Firebase Auth for authentication</li>
                <li>Firebase Storage for files</li>
                <li>Vercel for hosting and CI/CD</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Data Model</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-1 text-sm">
                <li>Quote Requests: countries, status, products, attachments</li>
                <li>Customers: ownerCountry, customerNumbers per country</li>
                <li>Notifications: country-targeted, real-time</li>
                <li>Users: role-based access, country assignments</li>
                <li>Messages: real-time chat with file attachments</li>
              </ul>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}


