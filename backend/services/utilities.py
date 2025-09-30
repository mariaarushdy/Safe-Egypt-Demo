from geopy.geocoders import Nominatim

def reverse_geocode(latitude, longitude):
    """
    Given latitude and longitude, return the address using Nominatim reverse geocoding.
    """
    geolocator = Nominatim(user_agent="my_reverse_geocoding_app")
    coordinates = f"{latitude}, {longitude}"
    location = geolocator.reverse(coordinates)
    return location.address if location else None

# Example usage:
# address = reverse_geocode(31.3521541, 27.2505678)
# print(address)