const electron = require('electron');
console.log('Type:', typeof electron);
console.log('Value:', electron);
console.log('Path:', require.resolve('electron'));
if (electron.app) {
    console.log("App is present");
} else {
    console.log("App is undefined");
}
