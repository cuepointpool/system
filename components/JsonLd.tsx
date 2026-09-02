import { SITE } from "@/lib/config";
import { TABLE_HOURLY_RATE } from "@/lib/config";

/** Structured data for the homepage — LocalBusiness + Organization + WebSite.
 *  Rendered server-side so crawlers and LLMs see it in the initial HTML. */
export function HomeJsonLd() {
  const { url, name, description, phone, email, address } = SITE;
  const img = `${url}/media/cover.png`;

  const graph = [
    {
      "@type": ["LocalBusiness", "SportsActivityLocation"],
      "@id": `${url}/#business`,
      name: `${name} Pool Parlour`,
      description,
      url,
      telephone: phone,
      email,
      image: img,
      priceRange: `LKR ${TABLE_HOURLY_RATE}/hour`,
      currenciesAccepted: "LKR",
      address: {
        "@type": "PostalAddress",
        streetAddress: address.line1,
        addressLocality: address.line2,
        addressRegion: address.region,
        postalCode: address.postalCode,
        addressCountry: "LK",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: address.geo.lat,
        longitude: address.geo.lng,
      },
      hasMap: address.maps,
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ],
          opens: "12:00",
          closes: "02:00",
        },
      ],
      potentialAction: {
        "@type": "ReserveAction",
        target: `${url}/book`,
        name: "Book a pool table",
      },
    },
    {
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name,
      url,
      logo: `${url}/media/logo-mark.png`,
      email,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: phone,
        contactType: "reservations",
        areaServed: "LK",
        availableLanguage: ["English", "Sinhala"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${url}/#website`,
      url,
      name,
      publisher: { "@id": `${url}/#organization` },
      inLanguage: "en",
    },
  ];

  return (
    <script
      type="application/ld+json"
      // structured data is static, generated here — safe to inline
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
