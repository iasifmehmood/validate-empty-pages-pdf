# validate-empty-pages-pdf

#npm start to start app

#localhost:3000/api-docs //for access swagger ui

-------------------------------------------------------------------------------------Start-----------------------------------------------------------------------------------------------------
#For mac and Linux if you are having issues installing node-poppler visit https://www.npmjs.com/package/node-poppler

#An example of downloading the binaries on a Debian system:

sudo apt-get install poppler-data
sudo apt-get install poppler-utils
For macOS users, you can download the latest versions with Homebrew:

brew install poppler
Once they have been installed, you will need to pass the poppler-utils installation directory as a parameter to an instance of the Poppler class:

const { Poppler } = require("node-poppler");
const poppler = new Poppler("/usr/bin");

--------------------------------------------------------------------------------------END--------------------------------------------------------------------------------------------------
