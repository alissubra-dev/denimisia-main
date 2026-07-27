'use client';

import Script from 'next/script';

const META_PIXEL_ID = '3968375216817052';

export function MetaPixel() {
  return (
    <>
      <Script
        id="meta-pixel-base"
        src="https://connect.facebook.net/en_US/fbevents.js"
        strategy="afterInteractive"
        onLoad={() => {
          // @ts-ignore
          if (window.fbq) {
            // @ts-ignore
            window.fbq('init', META_PIXEL_ID);
            // @ts-ignore
            window.fbq('track', 'PageView');
          }
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

export { META_PIXEL_ID };
