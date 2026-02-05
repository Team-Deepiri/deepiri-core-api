import express, { Request, Response } from 'express';
import externalApiService from '../services/externalApiService';
import { secureLog } from '../utils/secureLogger';

const router = express.Router();

router.get('/places/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '5000', type = 'establishment', keyword } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const places = await externalApiService.getNearbyPlaces(
      location,
      parseInt(radius as string),
      type as string,
      keyword as string | null
    );

    res.json({
      success: true,
      data: places
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get nearby places:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/places/:placeId', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params;
    const details = await externalApiService.getPlaceDetails(placeId);

    res.json({
      success: true,
      data: details
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get place details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/directions', async (req: Request, res: Response) => {
  try {
    const { fromLat, fromLng, toLat, toLng, mode = 'walking' } = req.query;

    if (!fromLat || !fromLng || !toLat || !toLng) {
      res.status(400).json({
        success: false,
        message: 'Origin and destination coordinates are required'
      });
      return;
    }

    const origin = { lat: parseFloat(fromLat as string), lng: parseFloat(fromLng as string) };
    const destination = { lat: parseFloat(toLat as string), lng: parseFloat(toLng as string) };

    const directions = await externalApiService.getDirections(origin, destination, mode as string);

    res.json({
      success: true,
      data: directions
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get directions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/weather/current', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const weather = await externalApiService.getCurrentWeather(location);

    res.json({
      success: true,
      data: weather
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get current weather:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/weather/forecast', async (req: Request, res: Response) => {
  try {
    const { lat, lng, days = '5' } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const forecast = await externalApiService.getWeatherForecast(location, parseInt(days as string));

    res.json({
      success: true,
      data: forecast
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get weather forecast:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/events/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '5000', category } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const events = await externalApiService.getNearbyEvents(
      location,
      parseInt(radius as string),
      category as string | null
    );

    res.json({
      success: true,
      data: events
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get nearby events:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/businesses/nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '5000', category, limit = '20' } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const businesses = await externalApiService.getNearbyBusinesses(
      location,
      parseInt(radius as string),
      category as string | null,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: businesses
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get nearby businesses:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const { address } = req.query;

    if (!address) {
      res.status(400).json({
        success: false,
        message: 'Address is required'
      });
      return;
    }

    const location = await externalApiService.geocodeAddress(address as string);

    res.json({
      success: true,
      data: location
    });

  } catch (error: any) {
    secureLog('error', 'Failed to geocode address:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const address = await externalApiService.reverseGeocode(location);

    res.json({
      success: true,
      data: address
    });

  } catch (error: any) {
    secureLog('error', 'Failed to reverse geocode:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/adventure-data', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = '5000', interests } = req.query;

    if (!lat || !lng) {
      res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
      return;
    }

    const location = { lat: parseFloat(lat as string), lng: parseFloat(lng as string) };
    const interestsArray = interests ? (interests as string).split(',') : [];
    
    const data = await externalApiService.getAdventureData(
      location,
      parseInt(radius as string),
      interestsArray
    );

    res.json({
      success: true,
      data: data
    });

  } catch (error: any) {
    secureLog('error', 'Failed to get adventure data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

