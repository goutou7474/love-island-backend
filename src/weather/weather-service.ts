export interface WeatherInfo {
  city: string
  temp: number
  condition: string
  accent: string
  updatedAt: string
}

export interface WeatherProvider {
  fetchCityWeather(city: string, index: number): Promise<WeatherInfo>
}

export interface WeatherService {
  getForCities(cities: string[]): Promise<WeatherInfo[]>
}

export interface CachedWeatherServiceOptions {
  now?: () => number
  ttlMs?: number
}

interface GeocodingResponse {
  results?: Array<{
    latitude: number
    longitude: number
  }>
}

interface ForecastResponse {
  current?: {
    temperature_2m?: number
    weather_code?: number
  }
}

const weatherAccent = ['#82d5bb', '#889df0', '#f8a6b2', '#f7cd67']

export class CachedWeatherService implements WeatherService {
  private readonly cache = new Map<string, { expiresAt: number; value: WeatherInfo }>()
  private readonly now: () => number
  private readonly ttlMs: number

  constructor(private readonly provider: WeatherProvider, options: CachedWeatherServiceOptions = {}) {
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? 10 * 60_000
  }

  async getForCities(cities: string[]) {
    const uniqueCities = normalizeCities(cities).slice(0, 2)

    return Promise.all(uniqueCities.map(async (city, index) => {
      const cached = this.cache.get(city)
      const accent = weatherAccent[index % weatherAccent.length]

      if (cached && cached.expiresAt > this.now()) {
        return {
          ...cached.value,
          accent,
          city,
        }
      }

      const value = await this.provider.fetchCityWeather(city, index)
      this.cache.set(city, {
        expiresAt: this.now() + this.ttlMs,
        value,
      })

      return {
        ...value,
        accent,
        city,
      }
    }))
  }
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  async fetchCityWeather(city: string, index: number): Promise<WeatherInfo> {
    const location = await geocodeCity(city)
    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
    forecastUrl.searchParams.set('latitude', String(location.latitude))
    forecastUrl.searchParams.set('longitude', String(location.longitude))
    forecastUrl.searchParams.set('current', 'temperature_2m,weather_code')
    forecastUrl.searchParams.set('timezone', 'Asia/Shanghai')

    const forecastResponse = await fetch(forecastUrl)
    if (!forecastResponse.ok) {
      throw new Error('天气服务暂时没有回应')
    }

    const forecast = await forecastResponse.json() as ForecastResponse

    return {
      accent: weatherAccent[index % weatherAccent.length],
      city,
      condition: weatherCodeLabel(forecast.current?.weather_code),
      temp: Math.round(forecast.current?.temperature_2m ?? 0),
      updatedAt: new Date().toISOString(),
    }
  }
}

export function createDefaultWeatherService() {
  return new CachedWeatherService(new OpenMeteoWeatherProvider())
}

export function normalizeCities(cities: string[]) {
  return Array.from(new Set(cities.map((city) => city.trim()).filter(Boolean)))
}

async function geocodeCity(city: string) {
  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geocodingUrl.searchParams.set('name', city)
  geocodingUrl.searchParams.set('count', '1')
  geocodingUrl.searchParams.set('language', 'zh')
  geocodingUrl.searchParams.set('format', 'json')

  const geocodingResponse = await fetch(geocodingUrl)
  if (!geocodingResponse.ok) {
    throw new Error('城市定位失败')
  }

  const geocoding = await geocodingResponse.json() as GeocodingResponse
  const result = geocoding.results?.[0]

  if (!result) {
    throw new Error(`没有找到 ${city} 的天气位置`)
  }

  return result
}

function weatherCodeLabel(code = 0) {
  if (code === 0) return '晴朗'
  if ([1, 2].includes(code)) return '少云'
  if (code === 3) return '多云'
  if ([45, 48].includes(code)) return '有雾'
  if ([51, 53, 55, 56, 57].includes(code)) return '毛毛雨'
  if ([61, 63, 65, 66, 67].includes(code)) return '下雨'
  if ([71, 73, 75, 77].includes(code)) return '下雪'
  if ([80, 81, 82].includes(code)) return '阵雨'
  if ([95, 96, 99].includes(code)) return '雷阵雨'

  return '天气更新中'
}
