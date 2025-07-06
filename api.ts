import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts";

export const utf8TextDecoder = new TextDecoder("utf-8");

export type WeatherDataPart = {
  date?: string;
  weather?: string;
  sky?: string; // day
  temp?: string;
  tempUnit?: string;
  wind: {
    direction?: string;
    directionCode?: string;
    level?: string;
  };
  sunrise?: string; // day
  sunset?: string; // night
};

export type WeatherData = {
  day: WeatherDataPart;
  night: WeatherDataPart;
};

export async function getWeatherData(id: string): Promise<WeatherData> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(`http://www.weather.com.cn/weather1d/${id}.shtml`);
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      
      const data = utf8TextDecoder.decode(await resp.arrayBuffer());

      const dom = new DOMParser().parseFromString(data, "text/html");

      if (dom == null) throw new Error("Failed to parse HTML");

      const nodeList = dom.querySelectorAll("#today > div.t > ul > li");
      if (nodeList.length !== 2) throw new Error("Failed to find today's weather");
      const [day, night] = nodeList as unknown as [Element, Element];

      const dayDate = day.querySelector("h1")?.textContent;
      const dayWeather = day.querySelector("p.wea")?.textContent;
      const daySky = day.querySelector("p.sky > span")?.textContent;
      const dayTemp = day.querySelector("p.tem > span")?.textContent;
      const dayTempUnit = day.querySelector("p.tem > em")?.textContent;
      const dayWindDirection = day
        .querySelector("p.win > span")
        ?.getAttribute("title");
      const dayWindDirectionCode = day
        .querySelector("p.win > i")
        ?.getAttribute("class");
      const dayWindLevel = day.querySelector("p.win > span")?.textContent;
      const daySunrise = day.querySelector("p.sun > span")?.textContent;

      const nightDate = night.querySelector("h1")?.textContent;
      const nightWeather = night.querySelector("p.wea")?.textContent;
      const nightTemp = night.querySelector("p.tem > span")?.textContent;
      const nightTempUnit = night.querySelector("p.tem > em")?.textContent;
      const nightWindDirection = night
        .querySelector("p.win > span")
        ?.getAttribute("title");
      const nightWindDirectionCode = night
        .querySelector("p.win > i")
        ?.getAttribute("class");
      const nightWindLevel = night.querySelector("p.win > span")?.textContent;
      const nightSunset = night.querySelector("p.sun > span")?.textContent;

      return {
        day: {
          date: dayDate,
          weather: dayWeather,
          sky: daySky,
          temp: dayTemp,
          tempUnit: dayTempUnit,
          wind: {
            direction: dayWindDirection ?? undefined,
            directionCode: dayWindDirectionCode ?? undefined,
            level: dayWindLevel,
          },
          sunrise: daySunrise,
        },
        night: {
          date: nightDate,
          weather: nightWeather,
          temp: nightTemp,
          tempUnit: nightTempUnit,
          wind: {
            direction: nightWindDirection ?? undefined,
            directionCode: nightWindDirectionCode ?? undefined,
            level: nightWindLevel,
          },
          sunset: nightSunset,
        },
      };
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed for weather data ${id}: ${lastError.message}`);
      
      if (attempt < maxRetries) {
        // Wait longer between retries (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  throw new Error(`Failed to get weather data for ${id} after ${maxRetries} attempts: ${lastError?.message}`);
}

export type RealtimeData = {
  nameen: string;
  cityname: string;
  city: string;
  temp: string;
  tempf: string;
  wde: string;
  WS: string;
  wse: string;
  SD: string;
  sd: string;
  qy: string;
  njd: string;
  time: string;
  rain: string;
  rain24h: string;
  aqi: string;
  aqi_pm25: string;
  weather: string;
  weathere: string;
  weathercode: string;
  limitnumber: string;
  date: string;
};

export async function getRealtimeData(id: string): Promise<RealtimeData> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://d1.weather.com.cn/sk_2d/${id}.html`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
          Referer: "http://www.weather.com.cn/",
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      const result = JSON.parse(text.replace("var dataSK=", ""));
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed for ${id}: ${lastError.message}`);
      
      if (attempt < maxRetries) {
        // Wait longer between retries (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  
  throw new Error(`Failed to get realtime data for ${id} after ${maxRetries} attempts: ${lastError?.message}`);
}
