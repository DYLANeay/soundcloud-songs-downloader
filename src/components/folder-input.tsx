import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface FolderInputProps {
  defaultValue: string;
  onSubmit: (path: string) => void;
}

export function FolderInput({ defaultValue, onSubmit }: FolderInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (raw: string) => {
    const path = raw.trim();
    if (!path) {
      setError("Path cannot be empty");
      return;
    }
    setError(null);
    onSubmit(path);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Save to: </Text>
        <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
