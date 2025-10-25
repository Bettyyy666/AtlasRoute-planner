import React, { useState, useEffect } from "react";
import Card from "../../components/Card/Card";
import "./SearchResults.css";
import { z } from "zod";
import { auth } from "../../firebase/firebaseConfig";
import { toast } from "react-toastify";
import { PinFolderService } from "../PinFolder/PinFolderService";

export const SearchResultItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.coerce.number(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  description: z.string().optional(),
});

export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

interface SearchResultsProps {
  results: SearchResultItem[];
  onSelect: (item: SearchResultItem) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect }) => {
  const [savedPins, setSavedPins] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Load saved pins status when component mounts or user changes
  useEffect(() => {
    const checkSavedPins = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // First sync pins from saved trips to pin folder
        await PinFolderService.syncPinsFromTrips(user.uid);
        
        const savedStatus: Record<string, boolean> = {};
        
        // Check each result item if it's already saved
        for (const item of results) {
          const isSaved = await PinFolderService.isPinSaved(
            user.uid, 
            item.name, 
            item.lat, 
            item.lng
          );
          savedStatus[item.id] = isSaved;
        }
        
        setSavedPins(savedStatus);
      } catch (error) {
        console.error("Error checking saved pins:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSavedPins();
  }, [results]);

  const handleSaveToFolder = async (e: React.MouseEvent, item: SearchResultItem) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    
    const user = auth.currentUser;
    if (!user) {
      toast.error("Please sign in to save pins to your folder");
      return;
    }
    
    try {
      // If already saved, don't save again
      if (savedPins[item.id]) {
        toast.info(`${item.name} is already in your pin folder`);
        return;
      }
      
      const pin = {
        name: item.name,
        description: item.description || "",
        duration: item.duration,
        lat: item.lat,
        lng: item.lng,
      };
      
      const success = await PinFolderService.addPin(user.uid, pin);
      if (success) {
        toast.success(`${item.name} saved to your pin folder`);
        // Update saved status
        setSavedPins(prev => ({
          ...prev,
          [item.id]: true
        }));
      }
    } catch (error) {
      console.error("Error saving pin:", error);
      toast.error("Failed to save pin to folder");
    }
  };

  if (results.length === 0) {
    return <p className="no-results">No results found.</p>;
  }

  return (
    <div className="search-results">
      {results.map((item) => (
        <div
          key={item.id}
          className="search-result-item"
          onClick={() => onSelect(item)}
        >
          <Card title={item.name} description={item.description}>
            <div 
              className={`save-status-indicator ${savedPins[item.id] ? 'saved' : ''}`}
              aria-label={`${savedPins[item.id] ? 'Saved' : 'Not saved'} ${item.name}`}
            >
              {savedPins[item.id] ? '📌 Saved' : 'To Save'}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;
