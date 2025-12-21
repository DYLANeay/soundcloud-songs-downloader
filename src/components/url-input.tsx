import { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface UrlInputProps {
  onSubmit: (url: string) => void;
}

export function UrlInput({ onSubmit }: UrlInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (url: string) => {
    if (!url.includes("soundcloud.com")) {
      setError("Please enter a valid SoundCloud URL");
      return;
    }
    setError(null);
    onSubmit(url);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Enter SoundCloud URL: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="https://soundcloud.com/artist/track"
        />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
