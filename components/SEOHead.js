'use client';

import Head from 'next/head';

/**
 * SEO Head component for consistent meta tags across pages
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} props.image - OG image URL
 * @param {string} props.url - Canonical URL
 * @param {string} props.type - OG type (website, article, etc.)
 * @param {Object} props.structuredData - Custom structured data JSON-LD
 */
export default function SEOHead({
    title = 'Indicore - AI-Powered UPSC, PCS & SSC Exam Preparation',
    description = 'Prepare for UPSC, PCS, and SSC exams with AI-powered tools including mock tests, PYQ database, essay evaluation, interview preparation, and personalized learning.',
    image = '/og-image.png',
    url = 'https://indicore.com',
    type = 'website',
    structuredData = null
}) {
    // Default structured data for the application
    const defaultStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Indicore',
        description: description,
        url: url,
        applicationCategory: 'EducationalApplication',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR'
        },
        operatingSystem: 'Web Browser',
        featureList: [
            'AI-powered chat assistant',
            'Mock test generation and evaluation',
            'Previous year questions database',
            'Essay writing enhancement',
            'Interview preparation',
            'Multi-language support',
            'Voice interface'
        ]
    };

    const schemaData = structuredData || defaultStructuredData;

    return (
        <Head>
            {/* Basic Meta Tags */}
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="canonical" href={url} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:locale" content="en_IN" />
            <meta property="og:site_name" content="Indicore" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={url} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Additional Meta Tags */}
            <meta name="keywords" content="UPSC preparation, PCS exam, SSC preparation, AI tutoring, mock tests, previous year questions, essay writing, interview preparation, Indian civil services" />
            <meta name="author" content="Indicore" />
            <meta name="theme-color" content="#ef4444" />

            {/* Structured Data (JSON-LD) */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schemaData)
                }}
            />
        </Head>
    );
}
