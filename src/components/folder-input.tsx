import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface FolderInputProps {
  defaultValue: string;
  outputDir: string;
  onSubmit: (folderName: string) => void;
}

// Strip filesystem-unsafe characters, collapse whitespace
function sanitize(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function FolderInput({ defaultValue, outputDir, onSubmit }: FolderInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (raw: string) => {
    const name = sanitize(raw);
    if (!name) {
      setError("Folder name cannot be empty");
      return;
    }
    setError(null);
    onSubmit(name);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Save to: {outputDir}/</Text>
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
