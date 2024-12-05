# URL Utilities App

The URL Utilities App provides simple URL services that allow you to create shortened versions of long URLs. This README provides an overview of the app's functionality and how to use it.

## Functionality

The main functionality of the URL Utilities App is to create a shortened version of a URL and then redirect users to the original URL when they access the shortened version. Additionally, the app keeps track of the number of times a shortened URL has been visited.

## Pre Requisites

This app requires a PostgresDB in order to run.

It is also recommended to use this app on a hosted environment with a dns entry which will not change for it, as it is supposed to be constant.

## Usage

To use the Utilities App, follow these steps:

1. Clone the repository to your local machine.
2. Install the required dependencies by running `npm install`.
3. Start the app by running `npm start`.
4. Access the app through your preferred web browser.
5. Enter a long URL in the provided input field and click the "Shorten" button.
6. The app will generate a shortened URL for you to use.
7. Share the shortened URL with others.
8. When someone accesses the shortened URL, they will be redirected to the original URL.
9. The app will keep track of the number of times the shortened URL has been visited.

That's it! You can now use the Utilities App to create and manage shortened URLs.

## TO DO's

- Swagger documentation
