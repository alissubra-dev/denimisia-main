'use client';

import Script from 'next/script';

const META_PIXEL_ID = '3968375216817052';

export function MetaPixel() {
  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var fbqScript = document.createElement('script');
              fbqScript.src = 'https://connect.facebook.net/en_US/fbevents.js';
              fbqScript.async = true;
              fbqScript.onload = function() {
                if (window.fbq) {
                  window.fbq('init', '${META_PIXEL_ID}');
                  window.fbq('track', 'PageView');
                }
              };
              document.head.appendChild(fbqScript);
            })();
          `.replace('${META_PIXEL_ID}', META_PIXEL_ID),
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
