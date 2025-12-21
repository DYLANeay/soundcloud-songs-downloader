Create a new service at `src/services/$ARGUMENTS.ts`.

Follow these patterns:
- Export a class or singleton instance for stateful services
- Export pure functions for stateless utilities
- Use Zod for validating external data
- Handle errors appropriately - throw for unrecoverable, return Result type for recoverable
- Add JSDoc for public API methods

Integrate with existing services in src/services/ when appropriate.
