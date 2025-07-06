import {
  getRealtimeData,
  getWeatherData,
  RealtimeData,
  utf8TextDecoder,
  WeatherData,
} from "./api.ts";

import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts";

const cityDataResp = await fetch(
  "https://j.i8tq.com/weather2020/search/city.js",
);

let cityData = utf8TextDecoder.decode(await cityDataResp.arrayBuffer());
cityData = JSON.parse(cityData.replace("var city_data = ", ""));

type CityData = {
  id: string;
  province: string;
  city: string;
  realtime?: RealtimeData;
  weather?: WeatherData;
};
const cities: CityData[] = Object.entries(cityData).map(([key, value]) => {
  const [c, v]: [string, any] = Object.entries(value)[0];
  const city = v[c] as Record<"AREAID" | "NAMECN", string>;

  return {
    id: city.AREAID,
    province: key,
    city: city.NAMECN,
  };
});

const today = new Date();
const date = format(today, "yyyy-MM-dd");
const datetime = format(today, "yyyy-MM-dd HH:mm:ss");

// Add delay function to avoid overwhelming the server
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Process cities with rate limiting and error handling
for (let i = 0; i < cities.length; i++) {
  const city = cities[i];
  console.log(`Processing ${i + 1}/${cities.length}: ${city.city}, ${city.province}`);
  
  try {
    city.realtime = await getRealtimeData(city.id);
    // Add small delay between requests
    await delay(100);
    
    city.weather = await getWeatherData(city.id);
    // Add small delay between requests
    await delay(100);
  } catch (error) {
    console.error(`Failed to get data for ${city.city}: ${error.message}`);
    // Continue with other cities even if one fails
  }
}

try {
  await Deno.mkdir(`weathers/${date}`, { recursive: true });
} catch {
  // ignore
}

const content = JSON.stringify(
  {
    timestamp: today.getTime(),
    lastUpdate: datetime,
    data: cities,
  },
  null,
  2,
);

// normalize filename
await Deno.writeTextFile(
  `weathers/${date}/${datetime.replace(/ /g, "_").replace(/:/g, "_")}.json`,
  content,
);

await Deno.writeTextFile(`weathers/${date}/latest.json`, content);

await Deno.writeTextFile(`weathers/latest.json`, content);
