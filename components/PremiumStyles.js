import Head from 'next/head';

/**
 * Inject premium styles globally
 */
export default function PremiumStyles() {
    return (
        <Head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            />
        </Head>
    );
}
