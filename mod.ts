import {
  getRealtimeData,
  getWeatherData,
  RealtimeData,
  utf8TextDecoder,
  WeatherData,
} from "./api.ts";

import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts";
import { zip } from "https://deno.land/x/zip@v1.2.5/mod.ts";
import { create } from "https://deno.land/x/zip@v1.2.5/mod.ts";

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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Process cities with rate limiting and error handling
for (let i = 0; i < cities.length; i++) {
  const city = cities[i];
  console.log(
    `Processing ${i + 1}/${cities.length}: ${city.city}, ${city.province}`,
  );

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

// Compress old weather data folders
async function compressOldWeatherData() {
  const weathersDir = "./weathers";
  const currentDate = new Date();
  // First day of current month
  const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  try {
    const entries = Deno.readDir(weathersDir);
    const foldersToCompress: string[] = [];

    for await (const entry of entries) {
      if (entry.isDirectory && entry.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const folderDate = new Date(entry.name);
        // If the folder is before the first day of the current month, mark it for compression
        if (folderDate < firstDayOfCurrentMonth) {
          foldersToCompress.push(entry.name);
        }
      }
    }

    // Group folders by month
    const foldersByMonth = new Map<string, string[]>();
    for (const folder of foldersToCompress) {
      const month = folder.substring(0, 7); // YYYY-MM
      if (!foldersByMonth.has(month)) {
        foldersByMonth.set(month, []);
      }
      foldersByMonth.get(month)!.push(folder);
    }

    // Compress each month's folders
    for (const [month, folders] of foldersByMonth) {
      const zipPath = `${weathersDir}/${month}.zip`;

      // Check if zip already exists
      try {
        await Deno.stat(zipPath);
        console.log(`Zip file ${zipPath} already exists, skipping...`);
        continue;
      } catch {
        // File doesn't exist, proceed with compression
      }

      console.log(`Compressing ${folders.length} folders for ${month}...`);

      try {
        // Create zip file
        await zip(folders.map(folder => `${weathersDir}/${folder}`), zipPath);

        // Remove original folders after successful compression
        for (const folder of folders) {
          await Deno.remove(`${weathersDir}/${folder}`, { recursive: true });
          console.log(`Removed folder: ${folder}`);
        }

        console.log(`Successfully compressed ${month} data to ${zipPath}`);
      } catch (error) {
        console.error(`Failed to compress ${month}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error during compression: ${error.message}`);
  }
}

// Run compression after saving current data
await compressOldWeatherData();
