import { useState, useEffect, useRef } from 'react';
import { X, Plus, Tag, Search } from 'lucide-react';
import type { Skill } from '../types';
import { getSkillCategoryColor } from '../lib/skillsLibrary';

interface SkillsAutocompleteProps {
  organizationId: string;
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  availableSkills: Skill[];
  placeholder?: string;
  maxSkills?: number;
}

export default function SkillsAutocomplete({
  organizationId,
  selectedSkills,
  onChange,
  availableSkills,
  placeholder = 'Add skills...',
  maxSkills,
}: SkillsAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter skills based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      // Show popular skills when no input
      const popular = [...availableSkills]
        .filter(s => !selectedSkills.includes(s.skill_name))
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 10);
      setFilteredSkills(popular);
    } else {
      const query = inputValue.toLowerCase();
      const filtered = availableSkills.filter(skill =>
        skill.skill_name.toLowerCase().includes(query) &&
        !selectedSkills.includes(skill.skill_name)
      );
      setFilteredSkills(filtered.slice(0, 10));
    }
  }, [inputValue, selectedSkills, availableSkills]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddSkill = (skillName: string) => {
    if (maxSkills && selectedSkills.length >= maxSkills) {
      return;
    }

    if (!selectedSkills.includes(skillName)) {
      onChange([...selectedSkills, skillName]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemoveSkill = (skillName: string) => {
    onChange(selectedSkills.filter(s => s !== skillName));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      // Add custom skill if not in library
      const exactMatch = filteredSkills.find(
        s => s.skill_name.toLowerCase() === inputValue.toLowerCase()
      );
      
      if (exactMatch) {
        handleAddSkill(exactMatch.skill_name);
      } else {
        // Add custom skill
        handleAddSkill(inputValue.trim());
      }
    }
  };

  const getSkillObject = (skillName: string): Skill | undefined => {
    return availableSkills.find(s => s.skill_name === skillName);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedSkills.map(skillName => {
            const skill = getSkillObject(skillName);
            const color = skill ? getSkillCategoryColor(skill.category) : 'gray';
            
            return (
              <span
                key={skillName}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-${color}-100 text-${color}-700 border border-${color}-200 rounded-full text-sm font-medium`}
              >
                <Tag className="w-3.5 h-3.5" />
                {skillName}
                <button
                  onClick={() => handleRemoveSkill(skillName)}
                  className={`hover:bg-${color}-200 rounded-full p-0.5 transition-colors`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={maxSkills ? selectedSkills.length >= maxSkills : false}
          />
        </div>

        {/* Dropdown */}
        {isOpen && filteredSkills.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredSkills.map(skill => (
              <button
                key={skill.id}
                onClick={() => handleAddSkill(skill.skill_name)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{skill.skill_name}</div>
                    {skill.description && (
                      <div className="text-xs text-gray-600 mt-0.5">{skill.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 bg-${getSkillCategoryColor(skill.category)}-100 text-${getSkillCategoryColor(skill.category)}-700 rounded-full`}>
                      {skill.category.replace('_', ' ')}
                    </span>
                    {skill.usage_count > 0 && (
                      <span className="text-xs text-gray-500">
                        {skill.usage_count} uses
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            
            {/* Add custom skill option */}
            {inputValue.trim() && !filteredSkills.some(s => s.skill_name.toLowerCase() === inputValue.toLowerCase()) && (
              <button
                onClick={() => handleAddSkill(inputValue.trim())}
                className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors border-t-2 border-blue-200"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    Add "{inputValue.trim()}" as custom skill
                  </span>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      <div className="mt-2 text-xs text-gray-500">
        {maxSkills && (
          <span>{selectedSkills.length}/{maxSkills} skills selected • </span>
        )}
        <span>Type to search or add custom skills</span>
      </div>
    </div>
  );
}

