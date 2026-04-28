import './globals.css';

export const metadata = {
  title: 'NutriAI – AI Calorie Counter',
  description: 'Your AI-powered nutrition coach. Track calories, scan food, and get a personalised meal plan.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
