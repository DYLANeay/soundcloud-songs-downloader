Create a new Ink component at `src/components/$ARGUMENTS.tsx`.

Follow these patterns:
- Use React functional component with hooks
- Import from "ink" for Box, Text, etc.
- Use TypeScript interface for props
- Export the component as a named export
- Keep components focused and composable

Example structure:
```tsx
import React from "react";
import { Box, Text } from "ink";

interface ComponentNameProps {
  // props here
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    <Box>
      <Text>Content</Text>
    </Box>
  );
}
```
