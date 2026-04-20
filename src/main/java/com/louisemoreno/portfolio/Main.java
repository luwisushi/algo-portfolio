package com.louisemoreno.portfolio;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;

public class Main {
    private static final int DEFAULT_PORT = 8080;
    private static final String STATIC_ROOT = "/static";
    private static final Map<String, String> MIME_TYPES = Map.ofEntries(
        Map.entry(".html", "text/html; charset=UTF-8"),
        Map.entry(".css", "text/css; charset=UTF-8"),
        Map.entry(".js", "application/javascript; charset=UTF-8"),
        Map.entry(".png", "image/png"),
        Map.entry(".jpg", "image/jpeg"),
        Map.entry(".jpeg", "image/jpeg"),
        Map.entry(".webp", "image/webp"),
        Map.entry(".svg", "image/svg+xml"),
        Map.entry(".ico", "image/x-icon")
    );

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(Optional.ofNullable(System.getenv("PORT")).orElse(String.valueOf(DEFAULT_PORT)));

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", Main::handleRequest);
        server.setExecutor(Executors.newFixedThreadPool(Math.max(2, Runtime.getRuntime().availableProcessors())));

        System.out.println("Algorithm Portfolio is running at http://localhost:" + port);
        server.start();
    }

    private static void handleRequest(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendText(exchange, 405, "Method Not Allowed");
            return;
        }

        String requestPath = normalizePath(exchange.getRequestURI().getPath());
        String resourcePath = "/".equals(requestPath) ? STATIC_ROOT + "/index.html" : STATIC_ROOT + requestPath;

        try (InputStream resourceStream = Main.class.getResourceAsStream(resourcePath)) {
            if (resourceStream == null) {
                sendText(exchange, 404, "Page not found");
                return;
            }

            byte[] content = resourceStream.readAllBytes();
            exchange.getResponseHeaders().set("Content-Type", getContentType(resourcePath));
            exchange.sendResponseHeaders(200, content.length);
            try (OutputStream responseBody = exchange.getResponseBody()) {
                responseBody.write(content);
            }
        }
    }

    private static String normalizePath(String path) {
        String safePath = path == null || path.isBlank() ? "/" : path.replace('\\', '/');
        if (!safePath.startsWith("/")) {
            safePath = "/" + safePath;
        }

        // Basic traversal protection.
        if (safePath.contains("..")) {
            return "/";
        }

        return safePath;
    }

    private static String getContentType(String path) {
        String lowerPath = path.toLowerCase();
        for (Map.Entry<String, String> mimeType : MIME_TYPES.entrySet()) {
            if (lowerPath.endsWith(mimeType.getKey())) {
                return mimeType.getValue();
            }
        }
        return "application/octet-stream";
    }

    private static void sendText(HttpExchange exchange, int statusCode, String message) throws IOException {
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, body.length);
        try (OutputStream responseBody = exchange.getResponseBody()) {
            responseBody.write(body);
        }
    }
}
