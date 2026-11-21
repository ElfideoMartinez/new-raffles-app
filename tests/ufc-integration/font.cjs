// Layout's Inter declaration needs no network access for a behavioral test.
module.exports = new Proxy({}, { get: () => "@font-face { font-family: 'Inter'; src: local('Arial'); font-style: normal; font-weight: 100 900; }" });
