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

const Page = () => {
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

    try {
      const spaceId = sdk.ids.space;
      const environmentId = sdk.ids.environment;
      const cma = sdk.cma;

      setProgress("Fetching content types...");
      const contentTypesResponse = await cma.contentType.getMany({
        spaceId,
        environmentId,
        query: { limit: 200 },
      });

      const contentTypes = contentTypesResponse.items;
      const allDuplicates = {};

      for (const ct of contentTypes) {
        const contentTypeId = ct.sys.id;
        const fieldId = ct.displayField || "title";
        setProgress(`Scanning: ${ct.name}...`);

        let allEntries = [];
        let skip = 0;
        let total = 1;

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

        const keyMap = {};

        allEntries.forEach((entry) => {
          const fieldData = entry.fields[fieldId];
          if (!fieldData) return;

          const locales = Object.keys(fieldData);
          const raw = locales.length > 0 ? fieldData[locales[0]] : null;
          const keyVal = typeof raw === "string" ? raw.trim().toLowerCase() : null;

          if (keyVal) {
            if (!keyMap[keyVal]) keyMap[keyVal] = [];
            keyMap[keyVal].push({
              id: entry.sys.id,
              title: raw.trim(),
              status: entry.sys.publishedAt ? "Published" : "Draft",
              updatedAt: new Date(entry.sys.updatedAt).toLocaleDateString(),
              url: `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entry.sys.id}`,
            });
          }
        });

        Object.entries(keyMap).forEach(([, entries]) => {
          if (entries.length > 1) {
            allDuplicates[`[${ct.name}] ${entries[0].title}`] = entries;
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

  return (
    <Box padding="spacingXl" style={{ maxWidth: "900px", margin: "0 auto" }}>
      <Text
        as="h1"
        fontWeight="fontWeightMedium"
        fontSize="fontSizeXl"
        marginBottom="spacingS"
      >
        🔍 Duplicate Entry Checker
      </Text>
      <Text fontColor="gray600" marginBottom="spacingL">
        Scans all content types in this environment for entries sharing the same
        title. Archived entries are excluded.
      </Text>

      <Button variant="primary" onClick={findDuplicates} isDisabled={loading}>
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
        <Note variant="negative" style={{ marginTop: "16px" }}>
          {error}
        </Note>
      )}

      {duplicates && duplicateKeys.length === 0 && (
        <Note variant="positive" style={{ marginTop: "16px" }}>
          ✨ No duplicates found across all content types!
        </Note>
      )}

      {duplicates && duplicateKeys.length > 0 && (
        <Box marginTop="spacingL">
          <Note variant="warning" style={{ marginBottom: "16px" }}>
            Found {duplicateKeys.length} duplicate set(s) across all content
            types
          </Note>

          {duplicateKeys.map((name) => (
            <Box
              key={name}
              padding="spacingM"
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: "6px",
                marginBottom: "12px",
              }}
            >
              <Text fontWeight="fontWeightMedium" marginBottom="spacingXs">
                {name}
              </Text>

              {duplicates[name].map((entry) => (
                <Box key={entry.id} style={{ marginTop: "6px" }}>
                  <Text fontSize="fontSizeS" fontColor="gray600">
                    {entry.status} · {entry.updatedAt} ·{" "}
                    <a href={entry.url} target="_blank" rel="noreferrer">
                      Open entry
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

export default Page;
