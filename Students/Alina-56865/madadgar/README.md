# Madadgar App

## Overview

Madadgar is a hyperlocal errand assistance app designed to connect users in need of small tasks with nearby helpers. The app aims to fill the gap in Pakistan's delivery ecosystem, particularly in urban areas like Lahore, Karachi, and Islamabad.

## Features

- **User Authentication**: Secure login and registration using phone number OTP via Firebase Authentication.
- **Task Management**: Users can post tasks, browse available tasks, and manage their ongoing tasks.
- **In-App Chat**: Real-time messaging between customers and helpers for seamless communication.
- **Geolocation Services**: Integration with Google Maps and Geolocator for location tracking and task discovery.
- **Rating System**: Customers can rate helpers after task completion, ensuring quality service.
- **Admin Panel**: Admins can manage users and tasks through Firebase Console.

## Setup Instructions

1. **Clone the Repository**:
   ```
   git clone <repository-url>
   cd madadgar
   ```

2. **Install Dependencies**:
   Ensure you have Flutter installed, then run:
   ```
   flutter pub get
   ```

3. **Firebase Configuration**:
   - Set up a Firebase project and configure Firestore, Authentication, and Cloud Functions.
   - Download the `google-services.json` (for Android) and `GoogleService-Info.plist` (for iOS) and place them in the respective platform directories.

4. **Run the App**:
   Use the following command to run the app on your desired platform:
   ```
   flutter run
   ```

## Usage Guidelines

- Users can switch between customer and helper roles seamlessly.
- Task posting requires entering details such as title, description, estimated cost, and pickup/delivery locations.
- Helpers can browse tasks and accept them based on their availability.
- Ratings and feedback can be provided after task completion to maintain service quality.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.