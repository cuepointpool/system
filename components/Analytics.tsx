import Script from "next/script";

/** GA4 (gtag.js) loader for every page. NEXT_PUBLIC_GA_ID overrides the
 *  default Cue Point measurement ID. */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID || "G-T6MXTNPFXL";
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
