import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="fr">
            <Head>
                <meta name="theme-color" content="#667eea" />
                <link rel="shortcut icon" href="/favicon.png" />
                <link rel="icon" type="image/png" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="57x57" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="60x60" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="72x72" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="76x76" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="114x114" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="120x120" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="144x144" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="152x152" href="/favicon.png" />
                <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
