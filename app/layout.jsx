import './globals.css';

export const metadata = {
  title: 'A Little Yellow Birthday — for Dlynn',
  description: 'Perjalanan ulang tahun kecil bernuansa kuning yang dibuat khusus untuk Dlynn.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
