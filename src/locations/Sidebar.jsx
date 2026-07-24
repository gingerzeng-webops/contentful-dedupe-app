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

  const findDuplicates = async () => {
    setLoading(true);
    setDuplicates(null);
    setError(null);

    try {
      const spaceId = sdk.ids.space;
      const environmentId = sdk.ids.environment;
      const contentTypeId = sdk.ids.contentType;
      const currentEntryId = sdk.ids.entry;
      const cma = sdk.cma;

      // Get the display field for this content type
      const contentType = await cma.contentType.get({
        spaceId,
        environmentId,
        contentTypeId,
      });
      const fieldId = contentType.displayField || "title";

      // Get the current entry's display field value
      const currentLocale = sdk.locales.default;
      const fieldValue = sdk.entry.fields[fieldId]?.getValue(currentLocale);

      if (!fieldValue || typeof fieldValue !== "string") {
        setDuplicates([]);
        return;
      }

      const normalizedValue = fieldValue.trim().toLowerCase();

      // Fetch all entries of this content type and find ones with the same display field value
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

      const matches = allEntries.filter((entry) => {
        if (entry.sys.id === currentEntryId) return false;
        const fieldData = entry.fields[fieldId];
        if (!fieldData) return false;
        const locales = Object.keys(fieldData);
        const raw = locales.length > 0 ? fieldData[locales[0]] : null;
        return typeof raw === "string" && raw.trim().toLowerCase() === normalizedValue;
      }).map((entry) => ({
        id: entry.sys.id,
        status: entry.sys.publishedAt ? "Published" : "Draft",
        updatedAt: new Date(entry.sys.updatedAt).toLocaleDateString(),
        url: `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entry.sys.id}`,
      }));

      setDuplicates(matches);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

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
        {loading ? "Checking..." : "Check for Duplicates"}
      </Button>

      {loading && (
        <Stack marginTop="spacingM" alignItems="center">
          <Spinner size="small" />
          <Text fontColor="gray600" fontSize="fontSizeS">
            Searching for duplicates...
          </Text>
        </Stack>
      )}

      {error && (
        <Note variant="negative" style={{ marginTop: "12px" }}>
          {error}
        </Note>
      )}

      {duplicates && duplicates.length === 0 && (
        <Note variant="positive" style={{ marginTop: "12px" }}>
          ✨ No duplicates found!
        </Note>
      )}

      {duplicates && duplicates.length > 0 && (
        <Box marginTop="spacingM">
          <Note variant="warning" style={{ marginBottom: "12px" }}>
            Found {duplicates.length} duplicate {duplicates.length === 1 ? "entry" : "entries"}
          </Note>

          {duplicates.map((entry) => (
            <Box
              key={entry.id}
              padding="spacingS"
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            >
              <Text fontSize="fontSizeS" fontColor="gray600">
                {entry.status} · {entry.updatedAt} ·{" "}
                <a href={entry.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Sidebar;
