// Entry point for pkg - imports ESM server.js
(async () => {
    try {
        const { default: server } = await import('./server.js');
        console.log('✅ Server started successfully');
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
})(); 