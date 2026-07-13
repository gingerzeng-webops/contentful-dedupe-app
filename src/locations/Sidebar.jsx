import { useSDK } from "@contentful/react-apps-toolkit";
import {
  Box,
  Button,
  Text,
  Note,
  Spinner,
  Stack,
} from "@contentful/f36-components";
import { useState } from "react";

const Sidebar = () => {
  const sdk = useSDK();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");

  const findDuplicates = async () => {
    setLoading(true);
    setDuplicates(null);
    setError(null);
    setProgress("");

    const FIELD_ID = "title"; // hardcoded since all content types use title as displayField

    try {
      const spaceId = sdk.ids.space;
      const environmentId = sdk.ids.environment;
      const cma = sdk.cma;

      // 1. Get all content types
      setProgress("Fetching content types...");
      const contentTypesResponse = await cma.contentType.getMany({
        spaceId,
        environmentId,
        query: { limit: 200 },
      });

      const contentTypes = contentTypesResponse.items;
      const allDuplicates = {};

      // 2. Loop through each content type
      for (const ct of contentTypes) {
        const contentTypeId = ct.sys.id;

        setProgress(`Scanning: ${ct.name}...`);

        let allEntries = [];
        let skip = 0;
        let total = 1;

        // 3. Paginate through all entries
        while (allEntries.length < total) {
          const response = await cma.entry.getMany({
            spaceId,
            environmentId,
            query: {
              content_type: contentTypeId,
              skip,
              limit: 1000,
              "sys.archivedAt[exists]": false,
            },
          });

          allEntries = allEntries.concat(response.items);
          total = response.total;
          skip += 1000;
        }

        // 4. Map entries by title field
        const keyMap = {};

        allEntries.forEach((entry) => {
          const fieldData = entry.fields[FIELD_ID];
          if (!fieldData) return;

          const locales = Object.keys(fieldData);
          const keyVal = locales.length > 0 ? fieldData[locales[0]] : null;

          if (keyVal) {
            if (!keyMap[keyVal]) keyMap[keyVal] = [];
            keyMap[keyVal].push({
              id: entry.sys.id,
              status: entry.sys.publishedAt ? "Published" : "Draft",
              updatedAt: new Date(entry.sys.updatedAt).toLocaleDateString(),
              url: `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entry.sys.id}`,
            });
          }
        });

        // 5. Collect duplicates for this content type
        Object.entries(keyMap).forEach(([val, entries]) => {
          if (entries.length > 1) {
            allDuplicates[`[${ct.name}] ${val}`] = entries;
          }
        });
      }

      setDuplicates(allDuplicates);
      setProgress("");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const duplicateKeys = duplicates ? Object.keys(duplicates) : [];

  const actualDuplicates = duplicates
    ? Object.values(duplicates).reduce(
        (sum, entries) => sum + (entries.length - 1),
        0,
      )
    : 0;

  return (
    <Box padding="spacingM">
      <Text fontWeight="fontWeightMedium" marginBottom="spacingM">
        Duplicate Entry Checker
      </Text>

      <Button
        variant="primary"
        size="small"
        onClick={findDuplicates}
        isDisabled={loading}
        isFullWidth
      >
        {loading ? "Scanning..." : "Scan for Duplicates"}
      </Button>

      {loading && (
        <Stack marginTop="spacingM" alignItems="center">
          <Spinner size="small" />
          <Text fontColor="gray600" fontSize="fontSizeS">
            {progress}
          </Text>
        </Stack>
      )}

      {error && (
        <Note variant="negative" style={{ marginTop: "12px" }}>
          {error}
        </Note>
      )}

      {duplicates && duplicateKeys.length === 0 && (
        <Note variant="positive" style={{ marginTop: "12px" }}>
          ✨ No duplicates found!
        </Note>
      )}

      {duplicates && duplicateKeys.length > 0 && (
        <Box marginTop="spacingM">
          <Note variant="warning" style={{ marginBottom: "12px" }}>
            Found {actualDuplicates} duplicate entr ies across{" "}
            {duplicateKeys.length} duplicate set(s)
          </Note>

          {duplicateKeys.map((name) => (
            <Box
              key={name}
              padding="spacingS"
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            >
              <Text
                fontWeight="fontWeightMedium"
                fontSize="fontSizeS"
                marginBottom="spacingXs"
              >
                {name}
              </Text>

              {duplicates[name].map((entry) => (
                <Box key={entry.id} style={{ marginTop: "4px" }}>
                  <Text fontSize="fontSizeS" fontColor="gray600">
                    {entry.status} · {entry.updatedAt} ·{" "}
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Sidebar;
