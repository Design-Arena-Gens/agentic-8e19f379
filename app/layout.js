import './globals.css';

export const metadata = {
  title: 'Discipline Table',
  description: 'A simple weekly habit/discipline tracker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
