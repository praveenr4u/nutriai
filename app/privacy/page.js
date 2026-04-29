export const metadata = {
  title: 'Privacy Policy — NutriAI',
  description: 'Privacy Policy for NutriAI AI Calorie Counter app',
};

export default function PrivacyPolicy() {
  const date = 'April 29, 2026';
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', color: '#1a1a1a', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <span style={{ fontSize:36 }}>🥗</span>
          <span style={{ fontSize:24, fontWeight:900, color:'#0B1612' }}>NutriAI</span>
        </div>
        <h1 style={{ fontSize:32, fontWeight:900, marginBottom:8 }}>Privacy Policy</h1>
        <p style={{ color:'#666', fontSize:14 }}>Last updated: {date}</p>
      </div>

      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'16px 20px', marginBottom:32 }}>
        <p style={{ fontSize:14, color:'#166534', margin:0 }}>
          <strong>Summary:</strong> NutriAI collects only the data needed to personalise your nutrition plan. We never sell your data to third parties.
        </p>
      </div>

      <Section title="1. Information We Collect">
        <p>We collect the following types of information:</p>
        <ul>
          <li><strong>Account information:</strong> Email address and name when you sign up</li>
          <li><strong>Health & body data:</strong> Age, gender, height, weight, activity level, health concerns, and dietary preferences that you voluntarily provide during onboarding</li>
          <li><strong>Food log data:</strong> Foods you log, calorie and macro information, and meal times</li>
          <li><strong>Camera data:</strong> When you use the food scanner, images are temporarily sent to Google Cloud Vision API for food recognition. Images are not stored by NutriAI</li>
          <li><strong>Usage data:</strong> App interactions and feature usage for improving the service</li>
        </ul>
      </Section>

      <Section title="2. How We Use Your Information">
        <ul>
          <li>To calculate your personalised daily calorie and macro targets using the Harris-Benedict formula</li>
          <li>To generate your weekly meal plan</li>
          <li>To track your food intake, water consumption, and progress</li>
          <li>To authenticate your account securely via Supabase</li>
          <li>To identify food items from camera images via Google Cloud Vision API</li>
          <li>To improve the accuracy and features of the app</li>
        </ul>
      </Section>

      <Section title="3. Data Storage & Security">
        <p>Your data is stored securely using <strong>Supabase</strong> (PostgreSQL database with Row Level Security), meaning only you can access your own data. All data is encrypted in transit using HTTPS and at rest.</p>
        <p>Camera images used for food scanning are processed in real-time by Google Cloud Vision API and are <strong>never stored</strong> on our servers.</p>
      </Section>

      <Section title="4. Third-Party Services">
        <p>NutriAI uses the following third-party services:</p>
        <ul>
          <li><strong>Supabase</strong> — Authentication and database storage (<a href="https://supabase.com/privacy" style={{color:'#16a34a'}}>Privacy Policy</a>)</li>
          <li><strong>Google Cloud Vision API</strong> — Food image recognition (<a href="https://policies.google.com/privacy" style={{color:'#16a34a'}}>Privacy Policy</a>)</li>
          <li><strong>Vercel</strong> — App hosting and deployment (<a href="https://vercel.com/legal/privacy-policy" style={{color:'#16a34a'}}>Privacy Policy</a>)</li>
        </ul>
        <p>We do not sell, trade, or rent your personal information to any third parties.</p>
      </Section>

      <Section title="5. Health Data">
        <p>NutriAI collects sensitive health-related data including body measurements, dietary preferences, and health conditions. This data is used exclusively to personalise your nutrition recommendations and is never shared with third parties, advertisers, or insurance companies.</p>
        <p>NutriAI is not a medical application. The calorie and nutrition recommendations provided are for general informational purposes only and should not replace advice from a qualified healthcare professional.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>Your account data is retained for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting us at the email below. We will delete your data within 30 days of your request.</p>
      </Section>

      <Section title="7. Children's Privacy">
        <p>NutriAI is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</p>
      </Section>

      <Section title="8. Your Rights">
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access</strong> the personal data we hold about you</li>
          <li><strong>Correct</strong> inaccurate data via your profile settings</li>
          <li><strong>Delete</strong> your account and all associated data</li>
          <li><strong>Export</strong> your data in a portable format</li>
          <li><strong>Opt out</strong> of non-essential data collection</li>
        </ul>
      </Section>

      <Section title="9. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes via email or an in-app notification. Continued use of NutriAI after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <Section title="10. Contact Us">
        <p>If you have any questions about this Privacy Policy or your data, please contact us:</p>
        <p><strong>Email:</strong> <a href="mailto:privacy@nutriai.app" style={{color:'#16a34a'}}>privacy@nutriai.app</a></p>
        <p><strong>App:</strong> NutriAI — AI Calorie Counter</p>
        <p><strong>Website:</strong> <a href="https://nutriai-sigma.vercel.app" style={{color:'#16a34a'}}>nutriai-sigma.vercel.app</a></p>
      </Section>

      <div style={{ borderTop:'1px solid #e5e7eb', marginTop:40, paddingTop:24, fontSize:13, color:'#9ca3af', textAlign:'center' }}>
        <p>© 2026 NutriAI. All rights reserved.</p>
        <p>This privacy policy is effective as of {date}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:32 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:12, color:'#0B1612', paddingBottom:8, borderBottom:'2px solid #f0fdf4' }}>{title}</h2>
      <div style={{ fontSize:15, color:'#374151' }}>{children}</div>
    </div>
  );
}
