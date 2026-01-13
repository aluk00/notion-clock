import { Project } from '../types';

const API_BASE = "https://createnotionproject-223535956454.us-central1.run.app";

export const fetchActiveProjects = async (): Promise<Project[]> => {
    try {
        const response = await fetch(`${API_BASE}/projects`, { method: 'GET' });
        if (!response.ok) throw new Error("Failed to fetch projects");
        
        const data = await response.json();
        const rawProjects = data.projects || [];

        // Map the raw API response to our Project interface
        return rawProjects.map((p: any) => ({
            id: p.id,
            name: p.title || "Untitled Project",
            client: p.client || "Internal"
        })).sort((a: Project, b: Project) => a.name.localeCompare(b.name));
        
    } catch (error) {
        console.error("Error fetching projects:", error);
        // Fallback if API fails, just so the app is usable
        return [
            { id: '1', name: 'Duracell x Football', client: 'Duracell' },
            { id: '2', name: 'Burger King x World Cup', client: 'Burger King' },
            { id: '3', name: 'Superdrug', client: 'Superdrug' },
        ];
    }
};