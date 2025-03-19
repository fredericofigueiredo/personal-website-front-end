import React, { useState } from "react";
import { Container, Row, Col, Form, Button, Alert } from "react-bootstrap";
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import Particle from "../Particle";  // Add this import

// Configure AWS
AWS.config.region = 'eu-central-1'; // your region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'eu-central-1:4a41c6ef-a80a-4391-88f3-0f1798ca25aa'
});

function AudioTranscriber() {
    const [file, setFile] = useState(null);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userId] = useState(uuidv4()); // Generate userId once when component mounts

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError("Please select a file");
            return;
        }
        setLoading(true);
        setError(null);

        try {
            // Configure S3
            const s3 = new AWS.S3();

            // Upload directly to user's folder in S3
            const fileName = `${userId}/${file.name}`;

            // Generate pre-signed URL
            const presignedUrl = await s3.getSignedUrlPromise('putObject', {
                Bucket: 'mna-raw-file-bucket',
                Key: fileName,
                ContentType: file.type,
                Expires: 60
            });

            // Upload file to S3
            await fetch(presignedUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type
                }
            });

            // Start polling for results immediately after upload
            pollForResults();

        } catch (err) {
            console.error(err);
            setError("An error occurred while uploading your file.");
            setLoading(false);
        }
    };

    const pollForResults = async () => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`https://unzw4kj7y4.execute-api.eu-central-1.amazonaws.com/prod/get-results?user_id=${userId}`);
                const data = await response.json();
                
                if (data && data.transcript) {  // If we have results
                    setResults(data);
                    setLoading(false);
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error(err);
                // Don't set error here - keep polling
            }
        }, 5000);  // Poll every 5 seconds
    
        // Stop polling after 5 minutes (optional)
        setTimeout(() => {
            clearInterval(pollInterval);
            if (loading) {
                setError("Processing timed out. Please try again.");
                setLoading(false);
            }
        }, 300000); // 5 minutes
    };
    

    return (
        <div className="project-section"style={{ 
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column"
          }}>
            <Particle />
        <Container fluid className="project-section" style={{ flex: 1 }}>
            <Container>
                <h1 className="project-heading">
                    Audio <strong className="purple">Transcriber </strong>
                </h1>
                {/* <p style={{ color: "white" }}>Upload your audio file and get insights</p> */}
                <Row style={{ justifyContent: "center", paddingBottom: "10px" }}>
                    <Col md={8} className="project-card">
                        <Form onSubmit={handleSubmit}>
                            <Form.Group>
                                <Form.Label style={{ color: "white" }}>Upload Audio File</Form.Label>
                                <Form.Control 
                                    type="file" 
                                    onChange={handleFileChange} 
                                    accept=".mp3,.wav,.m4a,.flac,.ogg"
                                    disabled={loading}
                                />
                            </Form.Group>
                            <Button 
                                variant="primary" 
                                type="submit" 
                                disabled={loading || !file}
                                className="mt-3"
                            >
                                {loading ? "Processing..." : "Transcribe"}
                            </Button>
                        </Form>
                        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
                        {results && (
                            <div className="results mt-4 p-4" style={{ 
                                backgroundColor: '#f8f9fa', 
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <h3 className="mb-4">Analysis Results</h3>
                                
                                {/* Sentiment Section */}
                                <div className="mb-4">
                                    <h5 className="purple">Overall Sentiment</h5>
                                    <div className="d-flex align-items-center">
                                        <span className="badge bg-primary" style={{ fontSize: '1rem' }}>
                                            {results.sentiment}
                                        </span>
                                    </div>
                                </div>

                                {/* Key Phrases Section */}
                                <div className="mb-4">
                                    <h5 className="purple">Key Phrases</h5>
                                    <div className="d-flex flex-wrap gap-2">
                                        {results.key_phrases.map((phrase, index) => (
                                            <span key={index} className="badge bg-secondary" 
                                                style={{ 
                                                    fontSize: '0.9rem',
                                                    padding: '8px 12px',
                                                    margin: '4px'
                                                }}>
                                                {phrase}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Transcript Section */}
                                <div>
                                    <h5 className="purple">Transcript</h5>
                                    <div style={{ 
                                        backgroundColor: 'white',
                                        padding: '15px',
                                        borderRadius: '6px',
                                        border: '1px solid #dee2e6',
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                    }}>
                                        <p style={{ 
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: '1.6'
                                        }}>
                                            {results.transcript}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Col>
                </Row>
            </Container>
        </Container>
    <div style={{ paddingBottom: "70px" }} />
    </div>
    );
}

export default AudioTranscriber;
