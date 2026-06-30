import React from "react";

export interface NetworkOption {
  networkName: string;
  address: string;
  icon?: React.ReactNode;
  color?: string;
}

export interface CryptoItem {
  id: string;
  name: string;
  symbol: string;
  network: string;
  address: string;
  iconUrl: string;
  color: string;
  networks?: NetworkOption[];
}

export const CRYPTO_LIST: CryptoItem[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin",
    address: "bc1qsjd2k4y35d2vxdq2csgh7l785fh850kz75sa6x",
    iconUrl: "/assets/crypto/bitcoin.png",
    color: "bg-[#F7931A]",
  },
  {
    id: "bch",
    name: "Bitcoin Cash",
    symbol: "BCH",
    network: "Bitcoin Cash",
    address: "bitcoincash:qq0xq568gwl89mn3c40gjj2mnp9n6yg83ss9wvp8uu",
    iconUrl: "/assets/crypto/bitcoin-cash.png",
    color: "bg-[#8DC351]",
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    network: "ERC20",
    address: "0xa0478E54042340aaDee067B3378a4dB1b371E359",
    iconUrl: "/assets/crypto/ethereum.png",
    color: "bg-[#627EEA]",
  },
  {
    id: "ltc",
    name: "Litecoin",
    symbol: "LTC",
    network: "Litecoin",
    address: "abc_ltc_mock_address_asdfg67890",
    iconUrl: "/assets/crypto/litecoin.png",
    color: "bg-[#A6A9AA]",
  },
  {
    id: "usdc",
    name: "USDC",
    symbol: "USDC",
    network: "ERC20",
    address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
    iconUrl: "/assets/crypto/usdc.png",
    color: "bg-[#2775CA]",
    networks: [
      {
        networkName: "Solana",
        address: "3ML8YfJzVTBiydSKvdWAM5NLGFqiwE91noADFgg54u8b",
        icon: React.createElement("img", { src: "/assets/crypto/solana.png", alt: "Solana", className: "size-3.5 object-contain" }),
        color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
      },
      {
        networkName: "Ethereum",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 32 32", className: "size-3.5" },
          React.createElement(
            "g",
            { fillRule: "evenodd" },
            React.createElement("circle", { cx: "50%", cy: "50%", r: "50%", fill: "#627EEA" }),
            React.createElement(
              "g",
              { fill: "#FFF" },
              React.createElement("path", { fillOpacity: ".602", d: "M16.498 4v8.87l7.497 3.35z" }),
              React.createElement("path", { d: "M16.498 4 9 16.22l7.498-3.35z" }),
              React.createElement("path", { fillOpacity: ".602", d: "M16.498 21.968v6.027L24 17.616z" }),
              React.createElement("path", { d: "M16.498 27.995v-6.028L9 17.616z" }),
              React.createElement("path", { fillOpacity: ".2", d: "m16.498 20.573 7.497-4.353-7.497-3.348z" }),
              React.createElement("path", { fillOpacity: ".602", d: "m9 16.22 7.498 4.353v-7.701z" })
            )
          )
        ),
        color: "bg-[#627EEA]",
      },
      {
        networkName: "BSC",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 30 30", className: "size-3.5" },
          React.createElement("circle", { cx: "15", cy: "15", r: "15", fill: "#F0B90B" }),
          React.createElement("path", { fill: "#fff", d: "M8.86 7.37 15 4l6.14 3.37-2.257 1.245L15 6.49l-3.883 2.125zm12.28 4.25-2.257-1.245L15 12.499l-3.883-2.124L8.86 11.62v2.49l3.883 2.124v4.25L15 21.729l2.257-1.245v-4.25l3.883-2.125zm0 6.739v-2.49l-2.257 1.245v2.49zm1.603.88-3.883 2.125v2.49l6.14-3.37v-6.74l-2.257 1.245zm-2.258-9.744 2.258 1.245v2.49L25 11.983v-2.49L22.743 8.25zm-7.742 12.77v2.49L15 26l2.257-1.245v-2.49L15 23.51zM8.86 18.36l2.257 1.245v-2.49L8.86 15.87zm3.883-8.864L15 10.74l2.257-1.245L15 8.25zM7.257 10.74l2.258-1.245L7.257 8.25 5 9.495v2.49l2.257 1.244zm0 4.25L5 13.743v6.74l6.14 3.37v-2.49l-3.883-2.125z" })
        ),
        color: "bg-[#F3BA2F]",
      },
      {
        networkName: "Polygon",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 507.91 446.91", className: "size-3.5 fill-[#8247E5]" },
          React.createElement("path", { d: "M384.58,136.59c-9.28-5.3-21.22-5.3-31.83,0l-74.26,43.77L228.1,208.2,155.16,252c-9.28,5.3-21.22,5.3-31.83,0l-57-34.48a32.33,32.33,0,0,1-15.92-27.85V123.33c0-10.61,5.31-21.22,15.92-27.85l57-33.15c9.28-5.31,21.22-5.31,31.83,0l57,34.48a32.31,32.31,0,0,1,15.92,27.85v43.76l50.39-29.18V94.16c0-10.61-5.3-21.22-15.91-27.85L156.48,4c-9.28-5.31-21.21-5.31-31.82,0L15.91,67.63C5.3,72.94,0,83.55,0,94.16V218.81C0,229.42,5.3,240,15.91,246.66L123.33,309c9.28,5.31,21.22,5.31,31.83,0l72.94-42.44,50.39-29.17,72.94-42.44c9.28-5.3,21.22-5.3,31.83,0l57,33.16A32.32,32.32,0,0,1,456.19,256v66.3c0,10.61-5.3,21.22-15.91,27.85l-55.7,33.16c-9.28,5.3-21.22,5.3-31.83,0l-57-33.16a32.32,32.32,0,0,1-15.91-27.85V279.82L229.42,309v43.76c0,10.61,5.31,21.22,15.92,27.85l107.41,62.33c9.29,5.31,21.22,5.31,31.83,0L492,380.6a32.32,32.32,0,0,0,15.91-27.85v-126c0-10.61-5.3-21.22-15.91-27.85Z" })
        ),
        color: "bg-[#8247E5]",
      },
    ],
  },
  {
    id: "usdt",
    name: "USDT",
    symbol: "USDT",
    network: "TRC20",
    address: "TYepTnkRXsT5j4LJTKWfyLM9rH3jVKZfz6",
    iconUrl: "/assets/crypto/usdt.png",
    color: "bg-[#26A17B]",
    networks: [
      {
        networkName: "Solana",
        address: "7xKX1v3TGYGmdn43Wf1cPpZ9QFDksvKkPpd7gS2HpxFz",
        icon: React.createElement("img", { src: "/assets/crypto/solana.png", alt: "Solana", className: "size-3.5 object-contain" }),
        color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
      },
      {
        networkName: "Ethereum",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 32 32", className: "size-3.5" },
          React.createElement(
            "g",
            { fillRule: "evenodd" },
            React.createElement("circle", { cx: "50%", cy: "50%", r: "50%", fill: "#627EEA" }),
            React.createElement(
              "g",
              { fill: "#FFF" },
              React.createElement("path", { fillOpacity: ".602", d: "M16.498 4v8.87l7.497 3.35z" }),
              React.createElement("path", { d: "M16.498 4 9 16.22l7.498-3.35z" }),
              React.createElement("path", { fillOpacity: ".602", d: "M16.498 21.968v6.027L24 17.616z" }),
              React.createElement("path", { d: "M16.498 27.995v-6.028L9 17.616z" }),
              React.createElement("path", { fillOpacity: ".2", d: "m16.498 20.573 7.497-4.353-7.497-3.348z" }),
              React.createElement("path", { fillOpacity: ".602", d: "m9 16.22 7.498 4.353v-7.701z" })
            )
          )
        ),
        color: "bg-[#627EEA]",
      },
      {
        networkName: "BSC",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 30 30", className: "size-3.5" },
          React.createElement("circle", { cx: "15", cy: "15", r: "15", fill: "#F0B90B" }),
          React.createElement("path", { fill: "#fff", d: "M8.86 7.37 15 4l6.14 3.37-2.257 1.245L15 6.49l-3.883 2.125zm12.28 4.25-2.257-1.245L15 12.499l-3.883-2.124L8.86 11.62v2.49l3.883 2.124v4.25L15 21.729l2.257-1.245v-4.25l3.883-2.125zm0 6.739v-2.49l-2.257 1.245v2.49zm1.603.88-3.883 2.125v2.49l6.14-3.37v-6.74l-2.257 1.245zm-2.258-9.744 2.258 1.245v2.49L25 11.983v-2.49L22.743 8.25zm-7.742 12.77v2.49L15 26l2.257-1.245v-2.49L15 23.51zM8.86 18.36l2.257 1.245v-2.49L8.86 15.87zm3.883-8.864L15 10.74l2.257-1.245L15 8.25zM7.257 10.74l2.258-1.245L7.257 8.25 5 9.495v2.49l2.257 1.244zm0 4.25L5 13.743v6.74l6.14 3.37v-2.49l-3.883-2.125z" })
        ),
        color: "bg-[#F3BA2F]",
      },
      {
        networkName: "Tron",
        address: "TYepTnkRXsT5j4LJTKWfyLM9rH3jVKZfz6",
        icon: React.createElement(
          "svg",
          { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 15 14", className: "size-3.5" },
          React.createElement("path", { fill: "#EF0027", d: "M7.875 14a7 7 0 1 0 0-14 7 7 0 0 0 0 14" }),
          React.createElement("path", { fill: "#fff", d: "M10.47 4.337 4.156 3.175l3.323 8.361 4.63-5.64zm-.101.512.966.918-2.642.478zm-2.25 1.3L5.335 3.84l4.55.838zm-.198.409-.454 3.754L5.019 4.15zm.42.199 2.926-.53-3.356 4.088z" })
        ),
        color: "bg-[#EC0928]",
      },
      {
        networkName: "Polygon",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: React.createElement("img", {
          src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAOCAYAAADwikbvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJNSURBVHgBZVJNSFRRGD3f9948Z8Sf8qcQtZpoISYqows17GflxmhVi/YFLtoEJhFEkiT0Q7VRklq6aCFBroKiNDVIU2JgNqFRMYE1Nuj8z7z7bve+mTHTC5d377vnnO+ecz/CrjHevnJEAOcFc6+U5HeYow5j2SGaGvzYPEcgWcTactJY2/KQJAwKMqoVGHpKYuTX7EiiZ6lY7upwqCX+H3msbummJGO4AESRXFwXRQTRjMXi7NB8U4w1caI92APwLX2ff1MTCOUHPTg5UAvvftPdg+hURpYMbFceb1uac8g4IShPcKuB0XW5Fk19lVj9kEBzXwVmJjbwaTqhziidROaA+aRjqdK2uccpEE2fgYbuckS+5uDvKsPUtTAi320EX8XRe6kai9NJjfNaztVn2sLwSzdCQtVRL85cr0c67iAazqoKgLDhinrLjYIVuN7JsBrMrAKYuqr61gfK8Hs1gzf31vXVcPHpYbT2V8IqYxwK+LDwPOYKaRFIIU2DZFiC1ZMSadX0lnCJOl02CV8Wkqhr8eH95Do2N2SerINjXiO9fRwIzqsf3VXHfOgfbcCPlRQq6j3IZiRejvxCKqFCZC6E6ZL/ZJMlx920H3aunAY8r1XahlXhQcu5fYh8y2FtMYWsveu9lYgjcX90tnFwu0kedIZGBOOGspAHa9CeZmGdzawtEv13VNMYRXL3z5p3Vl1rUjI6lF+f9iwLlfIhcY6YX0QjmxceLTfH9/S2HrdbP/u5tPSKshBQidWo22wJySHV2JN35hvf7sT+BfhCACn5p+vOAAAAAElFTkSuQmCC",
          alt: "Polygon",
          className: "size-3.5 object-contain",
        }),
        color: "bg-[#8247E5]",
      },
    ],
  },
  {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    network: "TRC20",
    address: "abc_tron_mock_address_mnbvc445566",
    iconUrl: "/assets/crypto/tron.png",
    color: "bg-[#EC0928]",
  },
  {
    id: "bnb",
    name: "Binance Coin",
    symbol: "BNB",
    network: "BEP20",
    address: "abc_bnb_mock_address_lkjhg778899",
    iconUrl: "/assets/crypto/binance-coin.png",
    color: "bg-[#F3BA2F]",
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    network: "Solana",
    address: "abc_sol_mock_address_poiuy001122",
    iconUrl: "/assets/crypto/solana.png",
    color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
  },
  {
    id: "xrp",
    name: "Ripple",
    symbol: "XRP",
    network: "Ripple",
    address: "abc_xrp_mock_address_mnbvc12345",
    iconUrl: "/assets/crypto/ripple.png",
    color: "bg-[#00AAE4]",
  },
  {
    id: "doge",
    name: "Dogecoin",
    symbol: "DOGE",
    network: "Dogecoin",
    address: "abc_doge_mock_address_doge667788",
    iconUrl: "/assets/crypto/dogecoin.png",
    color: "bg-[#C2A633]",
  },
];
